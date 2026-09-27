const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const pool = require('../src/config/database');
const enrichmentService = require('../src/modules/enrichment/enrichmentService');
const jobRepository = require('../src/modules/jobs/jobRepository');
const { runOnce } = require('../src/modules/jobs/worker');

// ---------------------------------------------------------------------------
// Part 1 — enrichment fallback chain. Fully deterministic via injected
// providers: no network calls, no dependence on .env geo flags.
// ---------------------------------------------------------------------------

test('provider A answering short-circuits provider B', async () => {
  let providerBCalled = false;

  const result = await enrichmentService.enrich('1.2.3.4', {
    providerA: async () => ({ countryCode: 'US', region: 'CA', city: 'SF', latitude: 1, longitude: 2, provider: 'ip-api' }),
    providerB: async () => {
      providerBCalled = true;
      return null;
    },
  });

  assert.equal(result.provider, 'ip-api');
  assert.equal(providerBCalled, false);
});

test('provider A down falls back to provider B', async () => {
  const result = await enrichmentService.enrich('1.2.3.4', {
    providerA: async () => null,
    providerB: async () => ({ countryCode: 'DE', region: 'BE', city: 'Berlin', latitude: 3, longitude: 4, provider: 'ipapi.co' }),
  });

  assert.equal(result.provider, 'ipapi.co');
});

test('both providers down returns null, not an error', async () => {
  const result = await enrichmentService.enrich('1.2.3.4', {
    providerA: async () => null,
    providerB: async () => null,
  });

  assert.equal(result, null);
});

test('no IP address returns null without calling either provider', async () => {
  let called = false;
  const result = await enrichmentService.enrich(null, {
    providerA: async () => { called = true; return null; },
    providerB: async () => { called = true; return null; },
  });

  assert.equal(result, null);
  assert.equal(called, false);
});

// ---------------------------------------------------------------------------
// Part 2 — background job lifecycle against the real, shared jobs table.
// Since other test files may run concurrently and enqueue their own jobs,
// every assertion here polls OUR job by id rather than trusting what a
// single runOnce() call happens to return.
// ---------------------------------------------------------------------------

let server;
let baseUrl;
let tenant;
let widget;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const runId = Date.now();
  tenant = await signup(`stage8-${runId}@test.com`, 'password123');
  widget = await createWidget(tenant);
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
}

function combineCookies(response) {
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

function extractCsrfToken(cookieString) {
  const match = cookieString.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function signup(email, password) {
  const response = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: email, email, password }),
  });
  assert.equal(response.status, 201);
  const cookie = combineCookies(response);
  const csrfToken = extractCsrfToken(cookie);
  const body = await response.json();
  return { cookie, csrfToken, ...body };
}

async function createWidget(tenant) {
  const response = await request('/api/widgets', {
    method: 'POST',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify({ name: 'Stage 8 Widget', type: 'lead_capture', config: {} }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).widget;
}

async function createSubmission() {
  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'lead@test.com' } }),
  });
  assert.equal(response.status, 201);
  return response.json();
}

async function drainJobsUntil(jobId, predicate, maxCycles = 25) {
  for (let i = 0; i < maxCycles; i += 1) {
    const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (predicate(rows[0])) return rows[0];
    await runOnce();
  }
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return rows[0];
}

test('a real submission enqueues a confirmation job that completes', async () => {
  const submission = await createSubmission();

  const { rows } = await pool.query(`SELECT * FROM jobs WHERE submission_id = $1`, [submission.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'submission_confirmation');
  assert.equal(rows[0].status, 'pending');

  const final = await drainJobsUntil(rows[0].id, (j) => j.status === 'completed');
  assert.equal(final.status, 'completed');
  assert.ok(final.completed_at);
});

test('a spam-flagged submission never queues a confirmation job', async () => {
  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'bot@test.com' },
      website: 'http://spam.example.com',
    }),
  });

  assert.equal(response.status, 201);
  const body = await response.json();

  const { rows } = await pool.query(`SELECT * FROM jobs WHERE submission_id = $1`, [body.id]);
  assert.equal(rows.length, 0);
});

test('a job with no registered handler fails permanently and sets failure_alerted_at', async () => {
  const submission = await createSubmission();

  const job = await jobRepository.enqueue({
    tenantId: tenant.tenant.id,
    submissionId: submission.id,
    type: 'nonexistent_job_type',
    maxAttempts: 1,
  });

  const final = await drainJobsUntil(job.id, (j) => j.status === 'failed');
  assert.equal(final.attempts, 1);
  assert.ok(final.failure_alerted_at);
  assert.match(final.last_error, /No handler registered/);
});

test('a job retries with backoff before eventually failing permanently', async () => {
  const submission = await createSubmission();

  const job = await jobRepository.enqueue({
    tenantId: tenant.tenant.id,
    submissionId: submission.id,
    type: 'nonexistent_job_type',
    // default max_attempts = 3, from the schema
  });

  let current = await drainJobsUntil(job.id, (j) => j.attempts >= 1);
  assert.equal(current.status, 'pending');
  assert.equal(current.failure_alerted_at, null);

  // Bypass the real backoff window instead of sleeping in the test.
  await pool.query(`UPDATE jobs SET available_at = NOW() WHERE id = $1`, [job.id]);
  current = await drainJobsUntil(job.id, (j) => j.attempts >= 2);
  assert.equal(current.status, 'pending');

  await pool.query(`UPDATE jobs SET available_at = NOW() WHERE id = $1`, [job.id]);
  current = await drainJobsUntil(job.id, (j) => j.status === 'failed');
  assert.equal(current.attempts, 3);
  assert.ok(current.failure_alerted_at);
});

test('retrying the same idempotency key does not enqueue a second job', async () => {
  const key = `stage8-retry-${Date.now()}`;

  const first = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'retry@test.com' }, idempotencyKey: key }),
  });
  assert.equal(first.status, 201);
  const firstBody = await first.json();

  const second = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'retry@test.com' }, idempotencyKey: key }),
  });
  assert.equal(second.status, 201);
  const secondBody = await second.json();

  assert.equal(firstBody.id, secondBody.id);

  const { rows } = await pool.query(`SELECT * FROM jobs WHERE submission_id = $1`, [firstBody.id]);
  assert.equal(rows.length, 1);
});

test.after(async () => {
  if (tenant?.tenant?.id) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenant.tenant.id]);
  }
  await pool.end();
  server.close();
});
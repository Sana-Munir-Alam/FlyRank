const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const pool = require('../src/config/database');
const env = require('../src/config/env');
const { liveLookupA, liveLookupB, isPrivateIp } = require('../src/modules/enrichment/providers');
const { runOnce } = require('../src/modules/jobs/worker');

let server;
let baseUrl;
let tenant;
let plainWidget;
let strictWidget;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  tenant = await signup(`stage14-${Date.now()}@test.com`, 'password123');

  plainWidget = await createWidget({
    name: 'Hardening Plain',
    type: 'lead_capture',
    config: { title: 'Plain' },
  });

  strictWidget = await createWidget({
    name: 'Hardening Strict',
    type: 'lead_capture',
    config: {
      title: 'Strict',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'company', label: 'Company', type: 'text' },
      ],
    },
  });
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

async function postWidget(body) {
  return request('/api/widgets', {
    method: 'POST',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify(body),
  });
}

async function createWidget(body) {
  const response = await postWidget(body);
  assert.equal(response.status, 201);
  return (await response.json()).widget;
}

function submit(widgetId, payload, extra = {}) {
  return request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId, payload, ...extra }),
  });
}

async function flushJobs() {
  for (let i = 0; i < 100; i += 1) {
    const job = await runOnce();
    if (!job) return;
  }
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

// ---------------------------------------------------------------------------
// Probe 2 — malformed and oversized input: clean 4xx JSON, never a 500
// ---------------------------------------------------------------------------

test('malformed JSON body returns a clean 400 JSON error', async () => {
  const response = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"widgetId": ',
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'Malformed JSON in request body');
});

test('oversized body returns 413 with a JSON error', async () => {
  const response = await submit(plainWidget.id, { blob: 'a'.repeat(200000) });

  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.error, 'Request body is too large');
});

test('unknown routes return a JSON 404 and do not advertise the framework', async () => {
  const response = await request('/api/does-not-exist');

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'Not found');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('a nested object as a field value is rejected with field-level details', async () => {
  const response = await submit(plainWidget.id, { name: { evil: true }, email: 'n@test.com' });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.details.some((d) => d.field === 'name'));
});

test('more than 30 fields is rejected', async () => {
  const payload = {};
  for (let i = 0; i < 31; i += 1) payload[`k${i}`] = 'v';

  const response = await submit(plainWidget.id, payload);
  assert.equal(response.status, 400);
});

test('an empty payload is rejected', async () => {
  const response = await submit(plainWidget.id, {});

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.details[0].message, 'Submission cannot be empty');
});

test('a payload of only whitespace values is rejected', async () => {
  const response = await submit(plainWidget.id, { name: '   ', email: '  ' });
  assert.equal(response.status, 400);
});

test('an invalid email on a default widget is rejected', async () => {
  const response = await submit(plainWidget.id, { email: 'not-an-email' });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.details.some((d) => d.field === 'email'));
});

test('a widget with defined fields rejects a missing required field', async () => {
  const response = await submit(strictWidget.id, { company: 'Acme' });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.details.some((d) => d.field === 'email' && /required/.test(d.message)));
});

test('a widget with defined fields rejects a malformed email', async () => {
  const response = await submit(strictWidget.id, { email: 'nope', company: 'Acme' });
  assert.equal(response.status, 400);
});

test('unknown keys are dropped, not stored, for widgets with defined fields', async () => {
  const response = await submit(strictWidget.id, { email: 'ok@test.com', company: 'Acme', evil: 'dropped' });
  assert.equal(response.status, 201);

  const { id } = await response.json();
  const { rows } = await pool.query(`SELECT payload FROM submissions WHERE id = $1`, [id]);
  assert.deepEqual(rows[0].payload, { email: 'ok@test.com', company: 'Acme' });
});

test('string values are trimmed before storing', async () => {
  const response = await submit(plainWidget.id, { email: '  trim@test.com  ' });
  assert.equal(response.status, 201);

  const { id } = await response.json();
  const { rows } = await pool.query(`SELECT payload FROM submissions WHERE id = $1`, [id]);
  assert.equal(rows[0].payload.email, 'trim@test.com');
});

test('widget config with an unknown field type is rejected', async () => {
  const response = await postWidget({
    name: 'Bad Config',
    type: 'lead_capture',
    config: { fields: [{ name: 'x', label: 'X', type: 'checkbox' }] },
  });
  assert.equal(response.status, 400);
});

test('widget config with duplicate field names is rejected', async () => {
  const response = await postWidget({
    name: 'Dup Config',
    type: 'lead_capture',
    config: {
      fields: [
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'email', label: 'Email again', type: 'text' },
      ],
    },
  });
  assert.equal(response.status, 400);
});

// ---------------------------------------------------------------------------
// Probe 4 — geo fallback chain, end to end through the real endpoint
// ---------------------------------------------------------------------------

async function submitAndReadGeo(email) {
  const response = await submit(plainWidget.id, { email });
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const { rows } = await pool.query(
    `SELECT geo_provider, country_code FROM submissions WHERE id = $1`,
    [id]
  );
  return rows[0];
}

test('provider A answering enriches the stored submission (mock-a)', async () => {
  env.geo.providerAMode = 'mock';
  env.geo.providerBMode = 'mock';
  try {
    const row = await submitAndReadGeo('geo-a@test.com');
    assert.equal(row.geo_provider, 'mock-a');
    assert.equal(row.country_code, 'US');
  } finally {
    env.geo.providerAMode = 'down';
    env.geo.providerBMode = 'down';
  }
});

test('provider A down: provider B enriches the stored submission (mock-b)', async () => {
  env.geo.providerAMode = 'down';
  env.geo.providerBMode = 'mock';
  try {
    const row = await submitAndReadGeo('geo-b@test.com');
    assert.equal(row.geo_provider, 'mock-b');
    assert.equal(row.country_code, 'DE');
  } finally {
    env.geo.providerBMode = 'down';
  }
});

test('both providers down: submission is stored without geo data', async () => {
  env.geo.providerAMode = 'down';
  env.geo.providerBMode = 'down';

  const row = await submitAndReadGeo('geo-none@test.com');
  assert.equal(row.geo_provider, null);
  assert.equal(row.country_code, null);
});

test('isPrivateIp recognises loopback and private ranges only', () => {
  for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.1.2.3', '192.168.1.5', '172.16.0.1', '169.254.1.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2001:4860:4860::8888']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('live providers skip private addresses without any network call', async () => {
  assert.equal(await liveLookupA('127.0.0.1'), null);
  assert.equal(await liveLookupB('192.168.1.10'), null);
});

// ---------------------------------------------------------------------------
// Probe 5 — a throwing email side effect never fails the submission
// ---------------------------------------------------------------------------

test('a throwing confirmation email still returns 201, keeps the row, and recovers on retry', async () => {
  await flushJobs(); // start from an empty queue so only our job is in play

  let submissionId;
  let jobId;

  env.email.forceFail = true;
  try {
    const response = await submit(plainWidget.id, { email: 'sidefx@test.com' });
    assert.equal(response.status, 201);
    submissionId = (await response.json()).id;

    const { rows: jobs } = await pool.query(`SELECT * FROM jobs WHERE submission_id = $1`, [submissionId]);
    jobId = jobs[0].id;

    const failing = await drainJobsUntil(jobId, (j) => j.attempts >= 1);
    assert.equal(failing.status, 'pending');
    assert.match(failing.last_error, /Forced email failure/);
  } finally {
    env.email.forceFail = false;
  }

  const { rows } = await pool.query(`SELECT id FROM submissions WHERE id = $1`, [submissionId]);
  assert.equal(rows.length, 1);

  await pool.query(`UPDATE jobs SET available_at = NOW() WHERE id = $1`, [jobId]);
  const recovered = await drainJobsUntil(jobId, (j) => j.status === 'completed');
  assert.equal(recovered.status, 'completed');
});

// ---------------------------------------------------------------------------
// Auth hardening — keep these last: the final test exhausts the auth limiter
// ---------------------------------------------------------------------------

async function signupRaw(body) {
  return request('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) });
}

test('signup with a 130-character company name is a 400, not a 500', async () => {
  const response = await signupRaw({
    tenantName: 'x'.repeat(130),
    email: `long-${Date.now()}@test.com`,
    password: 'password123',
  });
  assert.equal(response.status, 400);
});

test('signup with an empty company name is rejected', async () => {
  const response = await signupRaw({
    tenantName: '   ',
    email: `empty-${Date.now()}@test.com`,
    password: 'password123',
  });
  assert.equal(response.status, 400);
});

test('signup with an over-long password is rejected', async () => {
  const response = await signupRaw({
    tenantName: 'Long Password Co',
    email: `pw-${Date.now()}@test.com`,
    password: 'p'.repeat(200),
  });
  assert.equal(response.status, 400);
});

test('signup with a malformed email is rejected', async () => {
  const response = await signupRaw({
    tenantName: 'Bad Email Co',
    email: 'not-an-email',
    password: 'password123',
  });
  assert.equal(response.status, 400);
});

test('login attempts are rate limited per IP', async () => {
  const attempts = env.rateLimit.auth.max + 5;
  const statuses = [];

  for (let i = 0; i < attempts; i += 1) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@test.com', password: 'wrongpassword' }),
    });
    statuses.push(response.status);
  }

  assert.ok(statuses.includes(401), 'early attempts should be plain 401s');
  assert.ok(statuses.includes(429), `expected a 429 in ${JSON.stringify(statuses)}`);

  const blocked = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'nobody@test.com', password: 'wrongpassword' }),
  });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Too many attempts/);
});

test.after(async () => {
  if (tenant?.tenant?.id) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenant.tenant.id]);
  }
  await pool.end();
  server.close();
});
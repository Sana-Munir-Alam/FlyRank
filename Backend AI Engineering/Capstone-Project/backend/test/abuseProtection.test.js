const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { buildRateLimiter, ipRateLimiter, widgetRateLimiter } = require('../src/middleware/rateLimit');

const app = require('../src/app');
const pool = require('../src/config/database');

// ---------------------------------------------------------------------------
// Part 1 — unit tests of the rate limiter middleware on throwaway apps with
// tiny, explicit thresholds. Each call to buildRateLimiter/ipRateLimiter/
// widgetRateLimiter creates its own independent in-memory store, so these
// are fully isolated from each other and from the real app.js instance
// exercised in Part 2 below.
// ---------------------------------------------------------------------------

function buildTestApp(limiter) {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(limiter);
  testApp.post('/ping', (req, res) => res.status(200).json({ ok: true }));
  return testApp;
}

test('generic rate limiter returns 429 once the limit is exceeded', async () => {
  const limiter = buildRateLimiter({
    windowMs: 60_000,
    max: 3,
    keyGenerator: () => 'fixed-key',
    message: 'slow down',
  });

  const testApp = buildTestApp(limiter);
  const server = testApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const statuses = [];
  for (let i = 0; i < 5; i += 1) {
    const response = await fetch(`${baseUrl}/ping`, { method: 'POST' });
    statuses.push(response.status);
  }

  server.close();
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
});

test('ip rate limiter keys by IP address', async () => {
  const limiter = ipRateLimiter({ windowMs: 60_000, max: 2 });
  const testApp = buildTestApp(limiter);
  const server = testApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await fetch(`${baseUrl}/ping`, { method: 'POST' });
    statuses.push(response.status);
  }

  server.close();
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('widget rate limiter keys by widgetId in the body, not by IP', async () => {
  const limiter = widgetRateLimiter({ windowMs: 60_000, max: 2 });
  const testApp = buildTestApp(limiter);
  const server = testApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function post(widgetId) {
    return fetch(`${baseUrl}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetId }),
    });
  }

  const widgetAStatuses = [];
  widgetAStatuses.push((await post('widget-a')).status);
  widgetAStatuses.push((await post('widget-a')).status);
  widgetAStatuses.push((await post('widget-a')).status);

  const widgetBFirstStatus = (await post('widget-b')).status;

  server.close();
  assert.deepEqual(widgetAStatuses, [200, 200, 429]);
  assert.equal(widgetBFirstStatus, 200);
});

// ---------------------------------------------------------------------------
// Part 2 — integration tests against the real app: honeypot behavior, and
// proof that the limiters are wired into the live /api/submissions route.
// node --test runs each test FILE in its own process, so state here starts
// fresh relative to other test files — but all tests WITHIN this file share
// one process, so each test below creates its own widget to stay isolated
// from the others in this same run.
// ---------------------------------------------------------------------------

let server;
let baseUrl;
let tenant;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const runId = Date.now();
  tenant = await signup(`stage7-${runId}@test.com`, 'password123');
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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

async function createWidget(tenant, name) {
  const response = await request('/api/widgets', {
    method: 'POST',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify({ name, type: 'lead_capture', config: { title: 'Contact Us' } }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  return body.widget;
}

test('a clean submission is stored with spam = false', async () => {
  const widget = await createWidget(tenant, 'Honeypot Clean Widget');

  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'real@test.com' } }),
  });

  assert.equal(response.status, 201);
  const body = await response.json();

  const { rows } = await pool.query(`SELECT spam, spam_reason FROM submissions WHERE id = $1`, [body.id]);
  assert.equal(rows[0].spam, false);
  assert.equal(rows[0].spam_reason, null);
});

test('a filled honeypot field is flagged as spam but still returns 201', async () => {
  const widget = await createWidget(tenant, 'Honeypot Bot Widget');

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
  assert.ok(body.id);

  const { rows } = await pool.query(`SELECT spam, spam_reason FROM submissions WHERE id = $1`, [body.id]);
  assert.equal(rows[0].spam, true);
  assert.equal(rows[0].spam_reason, 'honeypot_field_filled');
});

test('a whitespace-only honeypot field is not treated as spam', async () => {
  const widget = await createWidget(tenant, 'Honeypot Whitespace Widget');

  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'edge@test.com' },
      website: '   ',
    }),
  });

  assert.equal(response.status, 201);
  const body = await response.json();

  const { rows } = await pool.query(`SELECT spam FROM submissions WHERE id = $1`, [body.id]);
  assert.equal(rows[0].spam, false);
});

test('rate limiting is wired into the live submission endpoint', async () => {
  const widget = await createWidget(tenant, 'Rate Limit Smoke Widget');

  const attempts = Number(process.env.RATE_LIMIT_WIDGET_MAX || 20) + 10;
  const statuses = [];

  for (let i = 0; i < attempts; i += 1) {
    const response = await request('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ widgetId: widget.id, payload: { i } }),
    });
    statuses.push(response.status);
  }

  assert.ok(statuses.includes(429), `expected at least one 429 in ${JSON.stringify(statuses)}`);
});

test('a different widget is unaffected while another widget is being rate limited', async () => {
  const floodedWidget = await createWidget(tenant, 'Flooded Widget');
  const quietWidget = await createWidget(tenant, 'Quiet Widget');

  const attempts = Number(process.env.RATE_LIMIT_WIDGET_MAX || 20) + 10;
  for (let i = 0; i < attempts; i += 1) {
    await request('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ widgetId: floodedWidget.id, payload: { i } }),
    });
  }

  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: quietWidget.id, payload: { hello: 'world' } }),
  });

  assert.equal(response.status, 201);
});

test.after(async () => {
  if (tenant?.tenant?.id) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenant.tenant.id]);
  }
  await pool.end();
  server.close();
});
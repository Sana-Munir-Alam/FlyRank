const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const pool = require('../src/config/database');

let server;
let baseUrl;
let tenant;
let widget;

test.before(async () => {
  server = app.listen(0);

  await new Promise((resolve) => {
    server.once('listening', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const runId = Date.now();

  tenant = await signup(`stage6-${runId}@test.com`, 'password123');
  widget = await createWidget(tenant);
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

async function createWidget(tenant) {
  const response = await request('/api/widgets', {
    method: 'POST',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify({
      name: 'Stage 6 Widget',
      type: 'lead_capture',
      config: { title: 'Contact Us' },
    }),
  });

  assert.equal(response.status, 201);

  const body = await response.json();
  return body.widget;
}

test('preflight OPTIONS request succeeds with CORS headers', async () => {
  const response = await request('/api/submissions', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://example.com',
      'Access-Control-Request-Method': 'POST',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
});

test('cross-origin submission succeeds and returns 201', async () => {
  const response = await request('/api/submissions', {
    method: 'POST',
    headers: { Origin: 'http://example.com' },
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'lead@test.com' },
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');

  const body = await response.json();
  assert.equal(body.widgetId, widget.id);
  assert.ok(body.id);
  assert.ok(body.createdAt);
});

test('submissions without an idempotency key each create a new row', async () => {
  const first = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'a@test.com' } }),
  });
  const second = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'b@test.com' } }),
  });

  const firstBody = await first.json();
  const secondBody = await second.json();

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(firstBody.id, secondBody.id);
});

test('different idempotency keys on the same widget create separate rows', async () => {
  const first = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'c@test.com' },
      idempotencyKey: 'key-a',
    }),
  });
  const second = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'd@test.com' },
      idempotencyKey: 'key-b',
    }),
  });

  const firstBody = await first.json();
  const secondBody = await second.json();

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(firstBody.id, secondBody.id);
});

test('same idempotency key retried returns the original submission, not a duplicate', async () => {
  const key = 'retry-key-1';

  const first = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'retry@test.com' },
      idempotencyKey: key,
    }),
  });
  const second = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { email: 'retry@test.com' },
      idempotencyKey: key,
    }),
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const firstBody = await first.json();
  const secondBody = await second.json();

  assert.equal(firstBody.id, secondBody.id);

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM submissions WHERE widget_id = $1 AND idempotency_key = $2`,
    [widget.id, key]
  );
  assert.equal(rows[0].count, 1);
});

test('malformed widgetId returns 400, not 500', async () => {
  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: 'not-a-uuid', payload: {} }),
  });

  assert.equal(response.status, 400);
});

test('non-existent widget returns 404', async () => {
  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: '00000000-0000-0000-0000-000000000000',
      payload: {},
    }),
  });

  assert.equal(response.status, 404);
});

test('oversized payload returns 413, not 500', async () => {
  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      widgetId: widget.id,
      payload: { blob: 'a'.repeat(200000) },
    }),
  });

  assert.equal(response.status, 413);
});

test('submission from an inactive widget returns 404', async () => {
  await request(`/api/widgets/${widget.id}`, {
    method: 'PATCH',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify({ active: false }),
  });

  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId: widget.id, payload: { email: 'x@test.com' } }),
  });

  assert.equal(response.status, 404);

  // reactivate so later tests / manual poking aren't affected
  await request(`/api/widgets/${widget.id}`, {
    method: 'PATCH',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify({ active: true }),
  });
});

test.after(async () => {
  if (tenant?.tenant?.id) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenant.tenant.id]);
  }

  await pool.end();
  server.close();
});
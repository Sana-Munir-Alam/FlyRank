const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const pool = require('../src/config/database');

let server;
let baseUrl;
let tenantA;
let tenantB;
let widgetA;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const runId = Date.now();
  tenantA = await signup(`stage9-a-${runId}@test.com`, 'password123');
  tenantB = await signup(`stage9-b-${runId}@test.com`, 'password123');

  widgetA = await createWidget(tenantA, 'Stage 9 Widget');
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

async function createWidget(tenant, name) {
  const response = await request('/api/widgets', {
    method: 'POST',
    headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
    body: JSON.stringify({ name, type: 'lead_capture', config: {} }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).widget;
}

async function submit(widgetId, payload, extra = {}) {
  const response = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({ widgetId, payload, ...extra }),
  });
  assert.equal(response.status, 201);
  return response.json();
}

test('unauthenticated request is rejected', async () => {
  const response = await request('/api/dashboard/overview');
  assert.equal(response.status, 401);
});

test('overview counts exclude spam and reflect real submissions', async () => {
  await submit(widgetA.id, { email: 'clean1@test.com' });
  await submit(widgetA.id, { email: 'clean2@test.com' });
  await submit(widgetA.id, { email: 'bot@test.com' }, { website: 'http://spam.example.com' });

  const response = await request('/api/dashboard/overview', {
    headers: { Cookie: tenantA.cookie },
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.ok(body.totalSubmissions >= 2);
  assert.ok(body.totalSpam >= 1);
  assert.equal(body.totalWidgets, 1);
});

test('tenant B sees zero widgets and zero submissions in their own overview', async () => {
  const response = await request('/api/dashboard/overview', {
    headers: { Cookie: tenantB.cookie },
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.totalWidgets, 0);
  assert.equal(body.totalSubmissions, 0);
});

test('submissions list excludes spam by default', async () => {
  const response = await request(`/api/dashboard/submissions?widgetId=${widgetA.id}`, {
    headers: { Cookie: tenantA.cookie },
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.ok(body.submissions.every((s) => s.spam === false));
});

test('submissions list includes spam when includeSpam=true is passed', async () => {
  const response = await request(
    `/api/dashboard/submissions?widgetId=${widgetA.id}&includeSpam=true`,
    { headers: { Cookie: tenantA.cookie } }
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.ok(body.submissions.some((s) => s.spam === true));
});

test('submissions list respects limit and offset', async () => {
  const response = await request(
    `/api/dashboard/submissions?widgetId=${widgetA.id}&limit=1&offset=0`,
    { headers: { Cookie: tenantA.cookie } }
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.submissions.length, 1);
  assert.ok(body.total >= 2);
});

test('invalid query params return 400, not 500', async () => {
  const response = await request('/api/dashboard/submissions?limit=not-a-number', {
    headers: { Cookie: tenantA.cookie },
  });

  assert.equal(response.status, 400);
});

test('tenant B cannot see tenant A submissions even by passing tenant A\'s widgetId', async () => {
  const response = await request(`/api/dashboard/submissions?widgetId=${widgetA.id}`, {
    headers: { Cookie: tenantB.cookie },
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  // widgetId belongs to tenant A, but the WHERE clause is scoped by tenant
  // B's tenant_id first — so no rows match, regardless of the filter.
  assert.equal(body.submissions.length, 0);
});

test('widget stats for own widget returns totals', async () => {
  const response = await request(`/api/dashboard/widgets/${widgetA.id}/stats`, {
    headers: { Cookie: tenantA.cookie },
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.widgetId, widgetA.id);
  assert.ok(body.totalSubmissions >= 2);
});

test('widget stats for another tenant\'s widget returns 404', async () => {
  const response = await request(`/api/dashboard/widgets/${widgetA.id}/stats`, {
    headers: { Cookie: tenantB.cookie },
  });

  assert.equal(response.status, 404);
});

test('malformed widget id in stats route returns 400', async () => {
  const response = await request('/api/dashboard/widgets/not-a-uuid/stats', {
    headers: { Cookie: tenantA.cookie },
  });

  assert.equal(response.status, 400);
});

test('geo breakdown reflects only non-spam submissions with geo data', async () => {
  const { id } = await submit(widgetA.id, { email: 'geo@test.com' });

  // Geo providers are disabled in .env for test runs, so no submission gets
  // real geo data automatically — set it directly to prove the aggregation
  // query itself, independent of Stage 8's provider chain.
  await pool.query(`UPDATE submissions SET country_code = 'US' WHERE id = $1`, [id]);

  const response = await request('/api/dashboard/geo', {
    headers: { Cookie: tenantA.cookie },
  });

  assert.equal(response.status, 200);
  const body = await response.json();

  const us = body.breakdown.find((row) => row.countryCode === 'US');
  assert.ok(us);
  assert.ok(us.count >= 1);
});

test.after(async () => {
  if (tenantA?.tenant?.id) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantA.tenant.id]);
  }
  if (tenantB?.tenant?.id) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantB.tenant.id]);
  }
  await pool.end();
  server.close();
});
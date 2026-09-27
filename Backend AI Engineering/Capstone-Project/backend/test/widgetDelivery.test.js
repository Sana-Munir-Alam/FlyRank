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

  tenant = await signup(
    `stage5-${runId}@test.com`,
    'password123'
  );

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
      name: 'Stage 5 Widget',
      type: 'lead_capture',
      config: { title: 'Contact Us' },
    }),
  });

  assert.equal(response.status, 201);

  const body = await response.json();

  return body.widget;
}

test('public config endpoint works without authentication', async () => {
  const response = await request(
    `/widgets/${widget.id}/config`
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.id, widget.id);
  assert.equal(body.name, 'Stage 5 Widget');
  assert.equal(body.type, 'lead_capture');
  assert.deepEqual(body.config, {
    title: 'Contact Us',
  });
  assert.equal(body.version, 1);
});

test('public config endpoint returns correct cache headers', async () => {
  const response = await request(
    `/widgets/${widget.id}/config`
  );

  assert.equal(response.status, 200);

  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=60, stale-while-revalidate=300'
  );
});

test('versioned widget bundle is publicly accessible', async () => {
  const response = await request(
    `/widget/v${widget.version}/widget.js`
  );

  assert.equal(response.status, 200);

  const contentType = response.headers.get('content-type');
  assert.ok(contentType.includes('javascript'));

  const body = await response.text();
  assert.ok(body.length > 0);
});

test('versioned widget bundle returns immutable cache headers', async () => {
    const response = await request(
        `/widget/v${widget.version}/widget.js`
    );

    assert.equal(response.status, 200);
    assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=31536000, immutable'
    );
});

test('authenticated user receives the embed snippet', async () => {
    const response = await request(`/api/widgets/${widget.id}/embed`,
        {
            headers: {Cookie: tenant.cookie,},
        }
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.widgetId, widget.id);
    assert.equal(body.version, 1);

    assert.equal(
        body.bundleUrl,
        `${baseUrl}/widget/v1/widget.js`
    );

    assert.equal(
        body.configUrl,
        `${baseUrl}/widgets/${widget.id}/config`
    );

    assert.equal(
        body.snippet,
        `<script src="${baseUrl}/widget/v1/widget.js" data-widget-id="${widget.id}" data-config-url="${baseUrl}/widgets/${widget.id}/config" defer></script>`
    );
});

test('updating a widget changes its version but not the bundle URL', async () => {
    const response = await request(`/api/widgets/${widget.id}`,
      {
        method: 'PATCH',
        headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
        body: JSON.stringify({ name: 'Updated Stage 5 Widget' }),
      }
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.widget.version, 2);

    const embedResponse = await request(`/api/widgets/${widget.id}/embed`,
        {
            headers: {Cookie: tenant.cookie,},
        }
    );

    assert.equal(embedResponse.status, 200);
    const embedBody = await embedResponse.json();
    assert.equal(embedBody.version, 2);
    assert.equal(embedBody.bundleVersion, 1);

    assert.equal(
        embedBody.bundleUrl,
        `${baseUrl}/widget/v1/widget.js`
    );

    assert.ok(embedBody.snippet.includes('/widget/v1/widget.js'));
});

test('version 1 widget bundle is publicly accessible', async () => {
    const response = await request(
        '/widget/v1/widget.js'
    );

    assert.equal(response.status, 200);
    const body = await response.text();
    assert.ok(body.length > 0);

    assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=31536000, immutable'
    );
});

test('invalid public widget ID returns 404', async () => {
  const response = await request('/widgets/not-a-valid-uuid/config');
  assert.equal(response.status, 404);
});

test('non-existent widget config returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request(`/widgets/${fakeId}/config`);
    assert.equal(response.status, 404);
});

test('unknown bundle version returns 404', async () => {
  const response = await request(
    '/widget/v99999/widget.js'
  );

  assert.equal(response.status, 404);
});

test.after(async () => {
    if (tenant?.tenant?.id) {
        await pool.query(
        `DELETE FROM tenants WHERE id = $1`,
        [tenant.tenant.id]
        );
    }

    await pool.end();
    server.close();
});
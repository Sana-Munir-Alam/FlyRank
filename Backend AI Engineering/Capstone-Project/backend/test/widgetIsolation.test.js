const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const pool = require('../src/config/database');

let server;
let baseUrl;
let tenantA;
let tenantB;

test.before(async () => {
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const runId = Date.now();

    tenantA = await signup(`tenant-a-${runId}@test.com`, 'password123');
    tenantB = await signup(`tenant-b-${runId}@test.com`, 'password123');
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

async function createWidget(tenant, data = {}) {
    const response = await request('/api/widgets', {
        method: 'POST',
        headers: { Cookie: tenant.cookie, 'X-CSRF-Token': tenant.csrfToken },
        body: JSON.stringify({
        name: 'Test Widget',
        type: 'test',
        config: {},
        ...data,
        }),
    });

    const body = await response.json();

    return { response, body };
}

test('tenant A can create a widget', async () => {
    const { response, body } = await createWidget(tenantA, {
        name: 'Tenant A Widget',
    });

    assert.equal(response.status, 201);
    assert.equal(body.widget.name, 'Tenant A Widget');
    assert.equal(body.widget.type, 'test');
    assert.equal(body.widget.tenant_id, tenantA.tenant.id);
});

test('tenant A can list their widgets', async () => {
    const response = await request('/api/widgets', {
        headers: { Cookie: tenantA.cookie },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.widgets));
    assert.ok(body.widgets.every(widget => widget.tenant_id === tenantA.tenant.id));
});

test('tenant B cannot read tenant A widget', async () => {
    const { body } = await createWidget(tenantA, {
        name: 'Private Tenant A Widget',
    });

    const response = await request(`/api/widgets/${body.widget.id}`, {
        headers: { Cookie: tenantB.cookie },
    });

    assert.equal(response.status, 404);
});

test('tenant B cannot edit tenant A widget', async () => {
    const { body } = await createWidget(tenantA, {
        name: 'Protected Widget',
    });

    const response = await request(`/api/widgets/${body.widget.id}`, {
        method: 'PATCH',
        headers: { Cookie: tenantB.cookie, 'X-CSRF-Token': tenantB.csrfToken },
        body: JSON.stringify({ name: 'Hacked' }),
    });

    assert.equal(response.status, 404);
});

test('tenant A can edit their own widget', async () => {
    const { body } = await createWidget(tenantA, {
        name: 'Widget Before Update',
    });

    const response = await request(`/api/widgets/${body.widget.id}`, {
        method: 'PATCH',
        headers: { Cookie: tenantA.cookie, 'X-CSRF-Token': tenantA.csrfToken },
        body: JSON.stringify({ name: 'Widget After Update' }),
    });

    assert.equal(response.status, 200);

    const result = await response.json();

    assert.equal(result.widget.name, 'Widget After Update');
});

test('malformed widget ID returns 400', async () => {
    const response = await request('/api/widgets/garbage', {
        headers: { Cookie: tenantA.cookie },
    });

    assert.equal(response.status, 400);
});

test('unauthenticated user cannot access widgets', async () => {
    const response = await request('/api/widgets');

    assert.equal(response.status, 401);
});

test('a request missing the CSRF token is rejected with 403', async () => {
    const response = await request('/api/widgets', {
        method: 'POST',
        headers: { Cookie: tenantA.cookie }, // no X-CSRF-Token
        body: JSON.stringify({ name: 'No Token Widget', type: 'test', config: {} }),
    });

    assert.equal(response.status, 403);
});

test('a request with the wrong CSRF token is rejected with 403', async () => {
    const response = await request('/api/widgets', {
        method: 'POST',
        headers: { Cookie: tenantA.cookie, 'X-CSRF-Token': 'not-the-real-token' },
        body: JSON.stringify({ name: 'Wrong Token Widget', type: 'test', config: {} }),
    });

    assert.equal(response.status, 403);
});

test('tenant A can delete their own widget', async () => {
    const { body } = await createWidget(tenantA, {
        name: 'Widget To Delete',
    });

    const deleteResponse = await request(`/api/widgets/${body.widget.id}`, {
        method: 'DELETE',
        headers: { Cookie: tenantA.cookie, 'X-CSRF-Token': tenantA.csrfToken },
    });

    assert.equal(deleteResponse.status, 204);

    const getResponse = await request(`/api/widgets/${body.widget.id}`, {
        headers: { Cookie: tenantA.cookie },
    });

    assert.equal(getResponse.status, 404);
});

test.after(async () => {
    await pool.query(
        `DELETE FROM tenants WHERE id IN ($1, $2)`,
        [tenantA.tenant.id, tenantB.tenant.id]
    );

    await pool.end();
    server.close();
});
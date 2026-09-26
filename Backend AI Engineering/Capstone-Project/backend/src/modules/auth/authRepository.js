const pool = require('../../config/database');

async function createTenantAndUser({ tenantName, email, passwordHash }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tenantResult = await client.query(
        `
            INSERT INTO tenants (name) VALUES ($1)
            RETURNING id, name, created_at
        `,
        [tenantName]
        );

        const tenant = tenantResult.rows[0];

        const userResult = await client.query(
        `
            INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, $2, $3)
            RETURNING id, tenant_id, email, created_at
        `,
        [tenant.id, email, passwordHash]
        );

        await client.query('COMMIT');
        return { tenant, user: userResult.rows[0],};
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function findUserByEmail(email) {
    const result = await pool.query(
        `
        SELECT u.id, u.tenant_id, u.email, u.password_hash, t.name AS tenant_name FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        WHERE u.email = $1
        `,
        [email]
    );

    return result.rows[0] || null;
}

async function findUserById(userId) {
    const result = await pool.query(
        `
        SELECT u.id, u.tenant_id, u.email, t.name AS tenant_name FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = $1
        `,
        [userId]
    );

    return result.rows[0] || null;
}

module.exports = {
    createTenantAndUser,
    findUserByEmail,
    findUserById,
};
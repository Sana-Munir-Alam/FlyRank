const pool = require('../../config/database');

async function create({ tenantId, widgetId, payload, ipAddress, userAgent, origin, idempotencyKey }) {
  const { rows } = await pool.query(
    `INSERT INTO submissions
       (tenant_id, widget_id, payload, ip_address, user_agent, origin, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (widget_id, idempotency_key) WHERE idempotency_key IS NOT NULL
     DO NOTHING
     RETURNING *`,
    [tenantId, widgetId, payload, ipAddress, userAgent, origin, idempotencyKey]
  );

  if (rows[0]) {
    return rows[0];
  }

  // A row already exists for this widget + idempotency key — return that one
  // instead of erroring, so retries are transparent to the client.
  if (idempotencyKey) {
    const existing = await pool.query(
      `SELECT * FROM submissions WHERE widget_id = $1 AND idempotency_key = $2`,
      [widgetId, idempotencyKey]
    );
    return existing.rows[0];
  }

  return null;
}

module.exports = { create };
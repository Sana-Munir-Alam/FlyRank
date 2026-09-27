const pool = require('../../config/database');

async function create({tenantId, widgetId, payload, ipAddress, userAgent, origin, idempotencyKey, spam = false, spamReason = null}) {
  const { rows } = await pool.query(
    `INSERT INTO submissions
       (tenant_id, widget_id, payload, ip_address, user_agent, origin, idempotency_key, spam, spam_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (widget_id, idempotency_key) WHERE idempotency_key IS NOT NULL
     DO NOTHING
     RETURNING *`,
    [tenantId, widgetId, payload, ipAddress, userAgent, origin, idempotencyKey, spam, spamReason]
  );

  if (rows[0]) {
    return { submission: rows[0], isNew: true };
  }

  if (idempotencyKey) {
    const existing = await pool.query(
      `SELECT * FROM submissions WHERE widget_id = $1 AND idempotency_key = $2`,
      [widgetId, idempotencyKey]
    );
    return { submission: existing.rows[0], isNew: false };
  }

  return { submission: null, isNew: false };
}

async function updateGeo(id, { countryCode, region, city, latitude, longitude, provider }) {
  const { rows } = await pool.query(
    `UPDATE submissions
     SET country_code = $1, region = $2, city = $3, latitude = $4, longitude = $5, geo_provider = $6
     WHERE id = $7
     RETURNING *`,
    [countryCode, region, city, latitude, longitude, provider, id]
  );
  return rows[0];
}

module.exports = { create, updateGeo };
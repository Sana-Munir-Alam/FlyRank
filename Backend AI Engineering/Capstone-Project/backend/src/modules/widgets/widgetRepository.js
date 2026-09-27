const pool = require('../../config/database');

async function create({ tenantId, name, type, config }) {
  const { rows } = await pool.query(
    `INSERT INTO widgets (tenant_id, name, type, config)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, name, type, config]
  );
  return rows[0];
}

async function findAll(tenantId) {
  const { rows } = await pool.query(
    `SELECT * FROM widgets WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows;
}

async function findById(tenantId, id) {
  const { rows } = await pool.query(
    `SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return rows[0];
}

async function update({ tenantId, id, ...fields }) {
  const allowed = ['name', 'type', 'config', 'active'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));

  if (!entries.length) return null;

  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${key} = $${index + 1}`);

  values.push(id, tenantId);

  const { rows } = await pool.query(
    `UPDATE widgets
     SET ${sets.join(', ')}, version = version + 1, updated_at = NOW()
     WHERE id = $${values.length - 1} AND tenant_id = $${values.length}
     RETURNING *`,
    values
  );

  return rows[0];
}

async function remove(tenantId, id) {
  const { rows } = await pool.query(
    `DELETE FROM widgets
     WHERE id = $1 AND tenant_id = $2
     RETURNING id`,
    [id, tenantId]
  );
  return rows[0];
}

async function findPublicById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, type, config, version, active FROM widgets
     WHERE id = $1`,
    [id]
  );

  return rows[0];
}

module.exports = { create, findAll, findById, findPublicById, update, remove };
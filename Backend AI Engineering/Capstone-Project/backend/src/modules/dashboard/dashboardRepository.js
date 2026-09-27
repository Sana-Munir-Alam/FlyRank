const pool = require('../../config/database');

async function getOverview(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE spam = false) AS total_submissions,
       COUNT(*) FILTER (WHERE spam = true) AS total_spam,
       COUNT(*) FILTER (WHERE spam = false AND created_at >= NOW() - INTERVAL '24 hours') AS submissions_last_24h,
       COUNT(*) FILTER (WHERE spam = false AND created_at >= NOW() - INTERVAL '7 days') AS submissions_last_7d
     FROM submissions
     WHERE tenant_id = $1`,
    [tenantId]
  );

  const widgetCount = await pool.query(
    `SELECT COUNT(*)::int AS total_widgets FROM widgets WHERE tenant_id = $1`,
    [tenantId]
  );

  return {
    totalWidgets: widgetCount.rows[0].total_widgets,
    totalSubmissions: Number(rows[0].total_submissions),
    totalSpam: Number(rows[0].total_spam),
    submissionsLast24h: Number(rows[0].submissions_last_24h),
    submissionsLast7d: Number(rows[0].submissions_last_7d),
  };
}

async function getSubmissions(tenantId, { widgetId, includeSpam, limit, offset }) {
  const conditions = ['s.tenant_id = $1'];
  const values = [tenantId];

  if (widgetId) {
    values.push(widgetId);
    conditions.push(`s.widget_id = $${values.length}`);
  }

  if (!includeSpam) {
    conditions.push('s.spam = false');
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM submissions s WHERE ${whereClause}`,
    values
  );

  const pageValues = [...values, limit, offset];
  const rowsResult = await pool.query(
    `SELECT s.id, s.widget_id, w.name AS widget_name, s.payload, s.country_code,
            s.region, s.city, s.spam, s.spam_reason, s.created_at
     FROM submissions s
     JOIN widgets w ON w.id = s.widget_id
     WHERE ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    pageValues
  );

  return { submissions: rowsResult.rows, total: countResult.rows[0].total };
}

async function getWidgetStats(tenantId, widgetId) {
  const widgetResult = await pool.query(
    `SELECT id, name FROM widgets WHERE id = $1 AND tenant_id = $2`,
    [widgetId, tenantId]
  );

  const widget = widgetResult.rows[0];
  if (!widget) return null;

  const totals = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE spam = false) AS total_submissions,
       COUNT(*) FILTER (WHERE spam = true) AS total_spam
     FROM submissions
     WHERE tenant_id = $1 AND widget_id = $2`,
    [tenantId, widgetId]
  );

  const daily = await pool.query(
    `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
    FROM submissions
    WHERE tenant_id = $1 AND widget_id = $2 AND spam = false
        AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY day ASC`,
    [tenantId, widgetId]
  );

  return {
    widgetId: widget.id,
    widgetName: widget.name,
    totalSubmissions: Number(totals.rows[0].total_submissions),
    totalSpam: Number(totals.rows[0].total_spam),
    dailyCounts: daily.rows.map((r) => ({ date: r.day, count: r.count })),
  };
}

async function getGeoBreakdown(tenantId) {
  const { rows } = await pool.query(
    `SELECT country_code, COUNT(*)::int AS count
     FROM submissions
     WHERE tenant_id = $1 AND spam = false AND country_code IS NOT NULL
     GROUP BY country_code
     ORDER BY count DESC`,
    [tenantId]
  );

  return rows.map((r) => ({ countryCode: r.country_code, count: r.count }));
}

module.exports = { getOverview, getSubmissions, getWidgetStats, getGeoBreakdown };
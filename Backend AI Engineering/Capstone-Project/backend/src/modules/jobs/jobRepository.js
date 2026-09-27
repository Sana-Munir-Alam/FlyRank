const pool = require('../../config/database');

async function enqueue({ tenantId, submissionId, type, maxAttempts }) {
  const { rows } = await pool.query(
    `INSERT INTO jobs (tenant_id, submission_id, type, max_attempts)
     VALUES ($1, $2, $3, COALESCE($4, 3))
     RETURNING *`,
    [tenantId, submissionId, type, maxAttempts || null]
  );
  return rows[0];
}

// SELECT ... FOR UPDATE SKIP LOCKED means multiple worker processes could
// run concurrently without ever double-processing the same row.
async function claimNext() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM jobs
       WHERE status = 'pending' AND available_at <= NOW()
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (!rows[0]) {
      await client.query('COMMIT');
      return null;
    }

    const updated = await client.query(
      `UPDATE jobs SET status = 'processing', locked_at = NOW() WHERE id = $1 RETURNING *`,
      [rows[0].id]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markCompleted(jobId) {
  await pool.query(`UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
}

// Retries with a short backoff while attempts remain; once max_attempts is
// hit, marks the job permanently failed and stamps failure_alerted_at — the "failure alert" the shared requirements ask for.
async function markFailed(job, errorMessage) {
  const attempts = job.attempts + 1;

  if (attempts >= job.max_attempts) {
    await pool.query(
      `UPDATE jobs SET status = 'failed', attempts = $1, last_error = $2, failure_alerted_at = NOW(), locked_at = NULL WHERE id = $3`,
      [attempts, errorMessage, job.id]
    );
    console.error(`[job:${job.id}] permanently failed after ${attempts} attempts: ${errorMessage}`);
    return;
  }

  const backoffSeconds = attempts * 5;
  await pool.query(
    `UPDATE jobs SET status = 'pending', attempts = $1, last_error = $2, locked_at = NULL, available_at = NOW() + ($3 || ' seconds')::interval WHERE id = $4`,
    [attempts, errorMessage, backoffSeconds, job.id]
  );
}

module.exports = { enqueue, claimNext, markCompleted, markFailed };
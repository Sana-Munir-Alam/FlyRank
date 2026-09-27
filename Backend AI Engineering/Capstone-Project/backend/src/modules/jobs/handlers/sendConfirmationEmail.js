const pool = require('../../../config/database');

async function sendConfirmationEmail(job) {
  const { rows } = await pool.query(
    `SELECT s.payload, w.name AS widget_name
     FROM submissions s JOIN widgets w ON w.id = s.widget_id
     WHERE s.id = $1`,
    [job.submission_id]
  );

  const submission = rows[0];
  if (!submission) {
    throw new Error(`Submission ${job.submission_id} not found`);
  }

  console.log(`[email] Confirmation for "${submission.widget_name}" (submission ${job.submission_id}):`, submission.payload);
}

module.exports = sendConfirmationEmail;
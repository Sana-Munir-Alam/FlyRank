const pool = require('../../../config/database');
const env = require('../../../config/env');

async function sendConfirmationEmail(job) {
  // Demo/test switch for acceptance probe 5: a broken email provider.
  if (env.email.forceFail) {
    throw new Error('Forced email failure (EMAIL_FORCE_FAIL=true)');
  }

  const { rows } = await pool.query(
    `SELECT s.payload, w.name AS widget_name
     FROM submissions s
     JOIN widgets w ON w.id = s.widget_id
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
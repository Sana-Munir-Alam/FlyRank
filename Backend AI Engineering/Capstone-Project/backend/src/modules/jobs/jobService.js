const jobRepository = require('./jobRepository');
const sendConfirmationEmail = require('./handlers/sendConfirmationEmail');

const handlers = {
  submission_confirmation: sendConfirmationEmail,
};

async function enqueueConfirmation({ tenantId, submissionId }) {
  return jobRepository.enqueue({ tenantId, submissionId, type: 'submission_confirmation' });
}

async function processJob(job) {
  const handler = handlers[job.type];

  if (!handler) {
    await jobRepository.markFailed(job, `No handler registered for job type "${job.type}"`);
    return;
  }

  try {
    await handler(job);
    await jobRepository.markCompleted(job.id);
  } catch (error) {
    await jobRepository.markFailed(job, error.message);
  }
}

module.exports = { enqueueConfirmation, processJob };
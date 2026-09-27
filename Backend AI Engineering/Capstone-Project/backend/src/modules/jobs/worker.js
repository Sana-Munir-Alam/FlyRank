const jobRepository = require('./jobRepository');
const jobService = require('./jobService');

let interval = null;

// runOnce lets tests trigger exactly one claim-and-process cycle synchronously, instead of waiting on the poll interval.
async function runOnce() {
  const job = await jobRepository.claimNext();
  if (!job) return null;
  await jobService.processJob(job);
  return job;
}

function startWorker({ pollIntervalMs }) {
  if (interval) return;
  interval = setInterval(() => {
    runOnce().catch((error) => console.error('Job worker cycle failed:', error));
  }, pollIntervalMs);
  interval.unref?.();
}

function stopWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

module.exports = { startWorker, stopWorker, runOnce };
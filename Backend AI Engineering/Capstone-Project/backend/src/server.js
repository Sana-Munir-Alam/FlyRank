const app = require('./app');
const env = require('./config/env');
const { startWorker } = require('./modules/jobs/worker');

const server = app.listen(env.port, () => {
  console.log(`API running on port ${env.port}`);
});

if (env.nodeEnv !== 'test') {
  startWorker({ pollIntervalMs: env.jobs.pollIntervalMs });
}

module.exports = server;
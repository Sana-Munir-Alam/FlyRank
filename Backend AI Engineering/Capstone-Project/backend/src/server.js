const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`API running on port ${env.port}`);
});

module.exports = server;
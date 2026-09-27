const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  rateLimit: {
    ip: {
      windowMs: Number(process.env.RATE_LIMIT_IP_WINDOW_MS || 60000),
      max: Number(process.env.RATE_LIMIT_IP_MAX || 100),
    },
    widget: {
      windowMs: Number(process.env.RATE_LIMIT_WIDGET_WINDOW_MS || 60000),
      max: Number(process.env.RATE_LIMIT_WIDGET_MAX || 20),
    },
  },
  geo: {
    timeoutMs: Number(process.env.GEO_PROVIDER_TIMEOUT_MS || 3000),
    providerADisabled: process.env.GEO_PROVIDER_A_DISABLED === 'true',
    providerBDisabled: process.env.GEO_PROVIDER_B_DISABLED === 'true',
  },
  jobs: {
    pollIntervalMs: Number(process.env.JOB_POLL_INTERVAL_MS || 2000),
  },
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

if (!env.sessionSecret) {
  throw new Error('SESSION_SECRET is not configured');
}

module.exports = env;
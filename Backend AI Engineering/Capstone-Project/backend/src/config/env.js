const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

const nodeEnv = process.env.NODE_ENV || 'development';
const isTest = nodeEnv === 'test';

const GEO_MODES = ['live', 'mock', 'down'];

function geoMode(name) {
  // Test runs are hermetic: they never touch the real geo APIs, whatever .env says.
  if (isTest) return 'down';

  const value = process.env[name] || 'live';
  if (!GEO_MODES.includes(value)) {
    throw new Error(`${name} must be one of: ${GEO_MODES.join(', ')} (got "${value}")`);
  }
  return value;
}

const env = {
  nodeEnv,
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
    auth: {
      windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 900000),
      max: Number(process.env.RATE_LIMIT_AUTH_MAX || 20),
    },
  },
  geo: {
    timeoutMs: Number(process.env.GEO_PROVIDER_TIMEOUT_MS || 3000),
    providerAMode: geoMode('GEO_PROVIDER_A_MODE'),
    providerBMode: geoMode('GEO_PROVIDER_B_MODE'),
  },
  email: {
    forceFail: !isTest && process.env.EMAIL_FORCE_FAIL === 'true',
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
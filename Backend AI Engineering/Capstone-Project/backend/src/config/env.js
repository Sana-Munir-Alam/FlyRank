const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

module.exports = env;
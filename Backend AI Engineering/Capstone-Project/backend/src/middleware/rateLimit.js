const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const env = require('../config/env');

function buildRateLimiter({ windowMs, max, keyGenerator, message }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json({ error: message || 'Too many requests, please try again later' });
    },
  });
}

function ipRateLimiter(options = {}) {
  return buildRateLimiter({
    windowMs: options.windowMs ?? env.rateLimit.ip.windowMs,
    max: options.max ?? env.rateLimit.ip.max,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    message: options.message || 'Too many requests from this IP, please slow down',
  });
}

function widgetRateLimiter(options = {}) {
  return buildRateLimiter({
    windowMs: options.windowMs ?? env.rateLimit.widget.windowMs,
    max: options.max ?? env.rateLimit.widget.max,
    keyGenerator: (req) => (req.body && req.body.widgetId) || ipKeyGenerator(req.ip),
    message: 'Too many submissions for this widget, please slow down',
  });
}

module.exports = {
  buildRateLimiter,
  ipRateLimiter,
  widgetRateLimiter,
};
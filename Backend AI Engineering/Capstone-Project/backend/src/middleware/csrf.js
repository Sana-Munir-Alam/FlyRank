const crypto = require('crypto');
const env = require('../config/env');

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Call this right after req.session.regenerate() succeeds in signup/login —
// the new session should carry a token from the moment it exists.
function issueCsrfToken(req, res) {
  const token = generateCsrfToken();
  req.session.csrfToken = token;
  res.cookie('csrf_token', token, {
    httpOnly: false, // must be readable by frontend JS to echo back in a header
    sameSite: 'lax',
    secure: env.nodeEnv === 'production'
  });
}

function requireCsrfToken(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  const headerToken = req.get('x-csrf-token');
  const sessionToken = req.session?.csrfToken;

  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  next();
}

module.exports = { issueCsrfToken, requireCsrfToken };
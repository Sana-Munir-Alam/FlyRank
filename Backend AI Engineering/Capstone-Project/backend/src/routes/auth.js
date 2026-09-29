const express = require('express');
const { z } = require('zod');

const authController = require('../modules/auth/authController');
const { requireAuth } = require('../middleware/auth');
const { requireCsrfToken } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const { ipRateLimiter } = require('../middleware/rateLimit');
const env = require('../config/env');

const router = express.Router();

// Brute-force protection: signup and login share one budget per IP.
const authLimiter = ipRateLimiter({
  windowMs: env.rateLimit.auth.windowMs,
  max: env.rateLimit.auth.max,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

const signupSchema = z.object({
  tenantName: z.string().trim().min(1).max(120), // DB column is varchar(120)
  email: z.string().trim().min(3).max(255).email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72), // bcrypt only uses the first 72 bytes
});

const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(72),
});

router.post('/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', requireAuth, requireCsrfToken, authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
const express = require('express');
const cors = require('cors');
const { z } = require('zod');

const validate = require('../middleware/validate');
const { ipRateLimiter, widgetRateLimiter } = require('../middleware/rateLimit');
const submissionController = require('../modules/submissions/submissionController');

const router = express.Router();

const publicCorsOptions = {
  origin: '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

// Mounted before the route: the cors package intercepts OPTIONS preflight
// requests itself and answers them, so no separate OPTIONS handler is needed.
router.use(cors(publicCorsOptions));
router.use((req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

router.use(ipRateLimiter());
router.use(widgetRateLimiter());

const submitSchema = z.object({
  widgetId: z.string().uuid(),
  payload: z.record(z.string(), z.any()),
  idempotencyKey: z.string().trim().min(1).max(255).optional(),
  website: z.string().max(500).optional().default(''), // Honeypot: a widget renders this field hidden from real users (Stage 13). A human never fills it; a bot script filling every input does.
});

router.post('/', validate(submitSchema), submissionController.create);

module.exports = router;
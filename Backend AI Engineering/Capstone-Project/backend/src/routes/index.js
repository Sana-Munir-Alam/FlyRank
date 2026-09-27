const express = require('express');
const { z } = require('zod');

const pool = require('../config/database');
const authRoutes = require('./auth');
const widgets = require('./widgets');
const publicWidgetController = require('../modules/widgets/publicWidgetController');

const router = express.Router();

const publicWidgetIdSchema = z.object({id: z.string().uuid(),});
const publicWidgetVersionSchema = z.object({version: z.string().regex(/^\d+$/),});

router.get('/health', async (req, res, next) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (error) {
        next(error);
    }
});

router.get('/widgets/:id/config', (req, res, next) => {
    const result = publicWidgetIdSchema.safeParse(req.params);
    if (!result.success) {
      return res.status(404).json({error: 'Widget not found',});
    }

    req.params = result.data;
    next();
  },
  publicWidgetController.config
);

router.get('/widget/v:version/widget.js', (req, res, next) => {
    const result = publicWidgetVersionSchema.safeParse(req.params);
    if (!result.success) {
      return res.status(404).json({error: 'Widget bundle not found',});
    }

    req.params = result.data;
    next();
  },
  publicWidgetController.bundle
);

router.use('/api/auth', authRoutes);
router.use('/api/widgets', widgets);

module.exports = router;
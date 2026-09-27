const express = require('express');
const { z } = require('zod');

const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const validateQuery = require('../middleware/validateQuery');
const dashboardController = require('../modules/dashboard/dashboardController');

const router = express.Router();

const idSchema = z.object({ id: z.string().uuid() });

const submissionsQuerySchema = z.object({
  widgetId: z.string().uuid().optional(),
  includeSpam: z.enum(['true', 'false']).optional().default('false').transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

router.use(requireAuth);

router.get('/overview', dashboardController.overview);
router.get('/submissions', validateQuery(submissionsQuerySchema), dashboardController.submissions);
router.get('/widgets/:id/stats', validate(idSchema, 'params'), dashboardController.widgetStats);
router.get('/geo', dashboardController.geo);

module.exports = router;
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const widgetController = require('../modules/widgets/widgetController');
const { requireCsrfToken } = require('../middleware/csrf');

const router = express.Router();

const idSchema = z.object({ id: z.string().uuid() });

const fieldSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  label: z.string().trim().min(1).max(100),
  type: z.enum(['text', 'email', 'textarea']),
  required: z.boolean().optional().default(false),
});

// Only title and fields are meaningful to the widget, so other keys are stripped.
const widgetConfigSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    fields: z.array(fieldSchema).max(20).optional(),
  })
  .refine(
    (config) => !config.fields || new Set(config.fields.map((f) => f.name)).size === config.fields.length,
    { message: 'Field names must be unique' }
  );

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(50),
  config: widgetConfigSchema.default({}),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    type: z.string().trim().min(1).max(50).optional(),
    config: widgetConfigSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

router.use(requireAuth);
router.use(requireCsrfToken); // GET passes through untouched; POST/PATCH/DELETE are checked

router.post('/', validate(createSchema), widgetController.create);
router.get('/', widgetController.findAll);
router.get('/:id/embed', validate(idSchema, 'params'), widgetController.getEmbed);
router.get('/:id', validate(idSchema, 'params'), widgetController.findById);
router.patch('/:id', validate(idSchema, 'params'), validate(updateSchema), widgetController.update);
router.delete('/:id', validate(idSchema, 'params'), widgetController.remove);

module.exports = router;
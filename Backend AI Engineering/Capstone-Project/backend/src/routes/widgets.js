const express = require('express');
const { z } = require('zod');
const {requireAuth} = require('../middleware/auth');
const validate = require('../middleware/validate');
const widgetController = require('../modules/widgets/widgetController');

const router = express.Router();

const idSchema = z.object({ id: z.string().uuid() });

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(50),
  config: z.record(z.string(), z.any()).default({}),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().min(1).max(50).optional(),
  config: z.record(z.string(), z.any()).optional(),
  active: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required' });

router.use(requireAuth);

router.post('/', validate(createSchema), widgetController.create);
router.get('/', widgetController.findAll);
router.get('/:id/embed', validate(idSchema, 'params'), widgetController.getEmbed);
router.get('/:id', validate(idSchema, 'params'), widgetController.findById);
router.patch('/:id', validate(idSchema, 'params'), validate(updateSchema), widgetController.update);
router.delete('/:id', validate(idSchema, 'params'), widgetController.remove);

module.exports = router;
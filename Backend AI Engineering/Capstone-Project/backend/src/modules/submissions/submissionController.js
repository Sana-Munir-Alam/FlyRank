const submissionService = require('./submissionService');

async function create(req, res, next) {
  try {
    const { widgetId, payload, idempotencyKey } = req.body;

    const submission = await submissionService.create({
      widgetId,
      payload,
      idempotencyKey,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      origin: req.get('origin') || null,
    });

    if (!submission) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    return res.status(201).json({
      id: submission.id,
      widgetId: submission.widget_id,
      createdAt: submission.created_at,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { create };
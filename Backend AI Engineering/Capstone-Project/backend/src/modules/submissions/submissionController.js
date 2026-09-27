const submissionService = require('./submissionService');

async function create(req, res, next) {
  try {
    const { widgetId, payload, idempotencyKey, website } = req.body;

    const submission = await submissionService.create({
      widgetId,
      payload,
      idempotencyKey,
      honeypotValue: website,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      origin: req.get('origin') || null,
    });

    if (!submission) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Response shape is identical whether or not the honeypot fired — a bot must never learn it was caught.
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
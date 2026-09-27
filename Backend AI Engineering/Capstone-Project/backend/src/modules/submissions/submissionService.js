const submissionRepository = require('./submissionRepository');
const widgetRepository = require('../widgets/widgetRepository');

async function create({ widgetId, payload, idempotencyKey, ipAddress, userAgent, origin }) {
  const widget = await widgetRepository.findPublicById(widgetId);

  if (!widget || !widget.active) {
    return null;
  }

  return submissionRepository.create({
    tenantId: widget.tenant_id,
    widgetId: widget.id,
    payload,
    ipAddress,
    userAgent,
    origin,
    idempotencyKey: idempotencyKey || null,
  });
}

module.exports = { create };
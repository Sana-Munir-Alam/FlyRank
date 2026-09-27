const submissionRepository = require('./submissionRepository');
const widgetRepository = require('../widgets/widgetRepository');

function detectHoneypot(honeypotValue) {
  const isSpam = typeof honeypotValue === 'string' && honeypotValue.trim().length > 0;
  return {
    spam: isSpam,
    spamReason: isSpam ? 'honeypot_field_filled' : null,
  };
}

async function create({ widgetId, payload, idempotencyKey, honeypotValue, ipAddress, userAgent, origin }) {
  const widget = await widgetRepository.findPublicById(widgetId);

  if (!widget || !widget.active) {
    return null;
  }

  const { spam, spamReason } = detectHoneypot(honeypotValue);

  return submissionRepository.create({
    tenantId: widget.tenant_id,
    widgetId: widget.id,
    payload,
    ipAddress,
    userAgent,
    origin,
    idempotencyKey: idempotencyKey || null,
    spam,
    spamReason,
  });
}

module.exports = { create };
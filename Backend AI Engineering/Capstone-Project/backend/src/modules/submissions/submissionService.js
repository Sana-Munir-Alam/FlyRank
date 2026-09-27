const submissionRepository = require('./submissionRepository');
const widgetRepository = require('../widgets/widgetRepository');
const enrichmentService = require('../enrichment/enrichmentService');
const jobService = require('../jobs/jobService');

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

  const { submission, isNew } = await submissionRepository.create({
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

  if (!submission) {
    return null;
  }

  // Enrichment and job creation only run on a genuinely new row — a
  // retried idempotent submission returns the original untouched, so it
  // never re-enriches or queues a second confirmation for the same event.
  if (isNew) {
    try {
      const geo = await enrichmentService.enrich(ipAddress);
      if (geo) {
        await submissionRepository.updateGeo(submission.id, geo);
      }
    } catch (error) {
      // Enrichment must never fail the submission — degrade, don't throw.
      console.error('Geo enrichment failed unexpectedly:', error);
    }

    if (!spam) {
      await jobService.enqueueConfirmation({
        tenantId: widget.tenant_id,
        submissionId: submission.id,
      });
    }
  }

  return submission;
}

module.exports = { create };
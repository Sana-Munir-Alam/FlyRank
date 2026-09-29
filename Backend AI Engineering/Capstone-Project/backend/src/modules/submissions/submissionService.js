const submissionRepository = require('./submissionRepository');
const widgetRepository = require('../widgets/widgetRepository');
const enrichmentService = require('../enrichment/enrichmentService');
const jobService = require('../jobs/jobService');
const { validateSubmissionPayload } = require('./submissionValidation');

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

  // Throws a 400 with field-level details; nothing below runs on bad input.
  const cleanPayload = validateSubmissionPayload(payload, widget.config);

  const { spam, spamReason } = detectHoneypot(honeypotValue);

  const { submission, isNew } = await submissionRepository.create({
    tenantId: widget.tenant_id,
    widgetId: widget.id,
    payload: cleanPayload,
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

  // Enrichment and job creation only run on a genuinely new row — a retried
  // idempotent submission never re-enriches or queues a second confirmation.
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
      // Queueing is a side effect too: a failure here must not fail a stored submission.
      try {
        await jobService.enqueueConfirmation({
          tenantId: widget.tenant_id,
          submissionId: submission.id,
        });
      } catch (error) {
        console.error('Could not queue confirmation job:', error);
      }
    }
  }

  return submission;
}

module.exports = { create };
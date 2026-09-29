const KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_KEYS = 30;
const MAX_VALUE_LENGTH = 5000;

function fail(details) {
  const error = new Error('Invalid submission data');
  error.statusCode = 400;
  error.details = details;
  return error;
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// Returns the cleaned payload to store, or throws a 400 with field-level details.
function validateSubmissionPayload(payload, widgetConfig) {
  const keys = Object.keys(payload);

  if (keys.length > MAX_KEYS) {
    throw fail([{ field: 'payload', message: `A submission can have at most ${MAX_KEYS} fields` }]);
  }

  const details = [];
  const cleaned = {};

  // Layer 1 — shape, applies to every widget: flat object of scalar values.
  for (const key of keys) {
    const value = payload[key];

    if (!KEY_PATTERN.test(key) || RESERVED_KEYS.has(key)) {
      details.push({ field: key.slice(0, 64), message: 'Invalid field name' });
      continue;
    }

    if (typeof value === 'string') {
      if (value.length > MAX_VALUE_LENGTH) {
        details.push({ field: key, message: `Must be at most ${MAX_VALUE_LENGTH} characters` });
        continue;
      }
      cleaned[key] = value.trim();
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      cleaned[key] = value;
    } else {
      details.push({ field: key, message: 'Must be text, a number, or true/false' });
    }
  }

  const fields =
    Array.isArray(widgetConfig?.fields) && widgetConfig.fields.length > 0 ? widgetConfig.fields : null;

  if (fields) {
    // Layer 2 — the widget defines its fields: enforce them, drop anything else.
    const allowed = new Set(fields.map((field) => field.name));
    for (const key of Object.keys(cleaned)) {
      if (!allowed.has(key)) delete cleaned[key];
    }

    for (const field of fields) {
      const value = cleaned[field.name];
      const label = field.label || field.name;

      if (isBlank(value)) {
        if (field.required) details.push({ field: field.name, message: `${label} is required` });
      } else if (field.type === 'email' && !EMAIL_PATTERN.test(String(value))) {
        details.push({ field: field.name, message: `${label} must be a valid email address` });
      }
    }
  } else if (!isBlank(cleaned.email) && !EMAIL_PATTERN.test(String(cleaned.email))) {
    // Layer 3 — default widgets: an "email" value, if present, must be an email.
    details.push({ field: 'email', message: 'Email must be a valid email address' });
  }

  if (details.length > 0) throw fail(details);

  if (Object.values(cleaned).every(isBlank)) {
    throw fail([{ field: 'payload', message: 'Submission cannot be empty' }]);
  }

  return cleaned;
}

module.exports = { validateSubmissionPayload };
const { lookupProviderA, lookupProviderB } = require('./providers');

// providerA/providerB are injectable so the fallback chain itself can be
// unit-tested deterministically, with no network calls and no dependence
// on .env geo flags — see test/enrichmentAndJobs.test.js Part 1.
async function enrich(ip, { providerA = lookupProviderA, providerB = lookupProviderB } = {}) {
  if (!ip) return null;

  const fromA = await providerA(ip);
  if (fromA) return fromA;

  const fromB = await providerB(ip);
  if (fromB) return fromB;

  // Both providers unavailable — the submission proceeds without geo data.
  return null;
}

module.exports = { enrich };
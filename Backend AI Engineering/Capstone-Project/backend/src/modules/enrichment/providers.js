const env = require('../../config/env');

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Provider A: ip-api.com — free, no key, 45 req/min.
async function lookupProviderA(ip) {
  if (env.geo.providerADisabled) return null;

  try {
    const response = await fetchWithTimeout(
      `http://ip-api.com/json/${ip}?fields=status,countryCode,regionName,city,lat,lon`,
      env.geo.timeoutMs
    );
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'success') return null;

    return {
      countryCode: data.countryCode || null,
      region: data.regionName || null,
      city: data.city || null,
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
      provider: 'ip-api',
    };
  } catch (error) {
    return null;
  }
}

// Provider B (fallback): ipapi.co — free tier, ~1,000 lookups/day, no key.
async function lookupProviderB(ip) {
  if (env.geo.providerBDisabled) return null;

  try {
    const response = await fetchWithTimeout(`https://ipapi.co/${ip}/json/`, env.geo.timeoutMs);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.error) return null;

    return {
      countryCode: data.country_code || null,
      region: data.region || null,
      city: data.city || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      provider: 'ipapi.co',
    };
  } catch (error) {
    return null;
  }
}

module.exports = { lookupProviderA, lookupProviderB };
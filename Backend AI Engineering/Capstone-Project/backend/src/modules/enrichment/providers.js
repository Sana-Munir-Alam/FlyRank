const env = require('../../config/env');

// Deterministic answers for demos and tests: one per provider, so you can see
// which provider in the chain actually answered (geo_provider column).
const MOCK_RESULTS = {
  a: { countryCode: 'US', region: 'California', city: 'Mountain View', latitude: 37.386, longitude: -122.0838, provider: 'mock-a' },
  b: { countryCode: 'DE', region: 'Berlin', city: 'Berlin', latitude: 52.52, longitude: 13.405, provider: 'mock-b' },
};

// Loopback/private addresses have no location, and shouldn't be sent to a third party.
function isPrivateIp(ip) {
  if (!ip) return true;

  const value = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (value === '::1' || value === '::') return true;
  if (/^fe[89ab][0-9a-f]:/i.test(value)) return true; // IPv6 link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(value)) return true; // IPv6 unique-local

  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return false;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

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
async function liveLookupA(ip) {
  if (isPrivateIp(ip)) return null;

  try {
    const response = await fetchWithTimeout(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city,lat,lon`,
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
    console.error('[geo] Provider A (ip-api.com) failed:', error.message);
    return null;
  }
}

// Provider B (fallback): ipapi.co — free tier, ~1,000 lookups/day, no key.
async function liveLookupB(ip) {
  if (isPrivateIp(ip)) return null;

  try {
    const response = await fetchWithTimeout(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      env.geo.timeoutMs
    );
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
    console.error('[geo] Provider B (ipapi.co) failed:', error.message);
    return null;
  }
}

// Mode is read at call time, so tests can flip it without reloading modules.
async function lookupProviderA(ip) {
  const mode = env.geo.providerAMode;
  if (mode === 'down') return null;
  if (mode === 'mock') return { ...MOCK_RESULTS.a };
  return liveLookupA(ip);
}

async function lookupProviderB(ip) {
  const mode = env.geo.providerBMode;
  if (mode === 'down') return null;
  if (mode === 'mock') return { ...MOCK_RESULTS.b };
  return liveLookupB(ip);
}

module.exports = { lookupProviderA, lookupProviderB, liveLookupA, liveLookupB, isPrivateIp };
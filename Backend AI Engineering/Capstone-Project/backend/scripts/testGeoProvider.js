// backend/scripts/testGeoProvider.js
// One-off manual verification script — not part of the automated test suite.
// Proves the real network path (HTTP call, JSON parsing, field mapping) works
// against the live provider APIs, independent of what IP a local dev request
// happens to arrive with (usually 127.0.0.1, which no provider can geolocate).
//
// Run with: node scripts/testGeoProvider.js

const { lookupProviderA, lookupProviderB } = require('../src/modules/enrichment/providers');

const PUBLIC_TEST_IP = '8.8.8.8'; // Google DNS — stable, public, safe to use in a demo

async function main() {
  console.log(`Testing provider A (ip-api.com) against ${PUBLIC_TEST_IP}...`);
  const resultA = await lookupProviderA(PUBLIC_TEST_IP);
  console.log('Provider A result:', resultA);

  console.log(`\nTesting provider B (ipapi.co) against ${PUBLIC_TEST_IP}...`);
  const resultB = await lookupProviderB(PUBLIC_TEST_IP);
  console.log('Provider B result:', resultB);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
// backend/scripts/testGeoProvider.js
// One-off manual verification script — not part of the automated test suite.
// Proves the real network path (HTTP call, JSON parsing, field mapping) works
// against the live provider APIs, independent of provider mode.
//
// Run with: node scripts/testGeoProvider.js

const {liveLookupA, liveLookupB,} = require('../src/modules/enrichment/providers');

const PUBLIC_TEST_IP = '8.8.8.8';

async function main() {
  console.log(`Testing provider A (ip-api.com) against ${PUBLIC_TEST_IP}...`);
  const resultA = await liveLookupA(PUBLIC_TEST_IP);
  console.log('Provider A result:', resultA);

  console.log(`\nTesting provider B (ipapi.co) against ${PUBLIC_TEST_IP}...`);
  const resultB = await liveLookupB(PUBLIC_TEST_IP);
  console.log('Provider B result:', resultB);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
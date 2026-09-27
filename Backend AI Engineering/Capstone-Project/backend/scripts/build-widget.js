const esbuild = require('esbuild');
const path = require('path');
const { BUNDLE_VERSION } = require('../src/config/constants');

const outfile = path.resolve(
  __dirname,
  `../../widget/dist/v${BUNDLE_VERSION}/widget.js`
);

esbuild
  .build({
    entryPoints: [path.resolve(__dirname, '../../widget/src/loader.js')],
    bundle: true,
    minify: true,
    outfile,
  })
  .then(() => {
    console.log(`Widget bundle built: v${BUNDLE_VERSION} -> ${outfile}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
const pkgJson = require('@npmcli/package-json')
const { nodeExternalsPlugin } = require('esbuild-node-externals')

const buildShallow = process.env.ATP_BUILD_SHALLOW === 'true'

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    plugins: buildShallow ? [nodeExternalsPlugin()] : [],
    external: ['level', 'classic-level'],
  })
  .then(() => (buildShallow ? pkgJson.load(__dirname) : null))
  .then((pkg) => (pkg?.update({ main: 'dist/index.js' }), pkg?.save))

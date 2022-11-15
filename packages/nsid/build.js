const { nodeExternalsPlugin } = require('esbuild-node-externals')

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    plugins: process.env.ATP_BUILD_SHALLOW ? [nodeExternalsPlugin()] : [],
  })
  .catch(() => process.exit(1))

const { nodeExternalsPlugin } = require('esbuild-node-externals')

const buildShallow =
  process.argv.includes('--shallow') || process.env.ATP_BUILD_SHALLOW === 'true'

require('esbuild').build({
  logLevel: 'info',
  entryPoints: ['src/index.ts', 'src/db/index.ts'],
  bundle: true,
  sourcemap: true,
  outdir: 'dist',
  platform: 'node',
  external: [
    // Referenced in pg driver, but optional and we don't use it
    'pg-native',
  ],
  plugins: buildShallow ? [nodeExternalsPlugin()] : [],
})

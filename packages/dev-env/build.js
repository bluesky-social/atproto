const { nodeExternalsPlugin } = require('esbuild-node-externals')
const hbsPlugin = require('esbuild-plugin-handlebars')

const buildShallow =
  process.argv.includes('--shallow') || process.env.ATP_BUILD_SHALLOW === 'true'

require('esbuild').build({
  logLevel: 'info',
  entryPoints: ['src/index.ts', 'src/bin.ts'],
  bundle: true,
  sourcemap: true,
  outdir: 'dist',
  platform: 'node',
  external: [
    'better-sqlite3',
    // Referenced in pg driver, but optional and we don't use it
    'pg-native',
    'sharp',
  ],
  plugins: [].concat(buildShallow ? [nodeExternalsPlugin()] : []).concat([
    hbsPlugin({
      filter: /\.(hbs)$/,
      additionalHelpers: {},
      precompileOptions: {},
    }),
  ]),
})

const { copy } = require('esbuild-plugin-copy')
const { nodeExternalsPlugin } = require('esbuild-node-externals')

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
    copy({
      assets: {
        from: ['../pds/src/mailer/templates/**/*'],
        to: ['./templates'],
        keepStructure: true,
      },
    }),
  ]),
})

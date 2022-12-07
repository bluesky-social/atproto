const pkgJson = require('@npmcli/package-json')
const { copy } = require('esbuild-plugin-copy')
const { nodeExternalsPlugin } = require('esbuild-node-externals')

const buildShallow =
  process.argv.includes('--shallow') || process.env.ATP_BUILD_SHALLOW === 'true'

if (process.argv.includes('--update-main-to-dist')) {
  return pkgJson
    .load(__dirname)
    .then((pkg) => pkg.update({ main: 'dist/index.js' }))
    .then((pkg) => pkg.save())
}

require('esbuild').build({
  logLevel: 'info',
  entryPoints: ['src/index.ts', 'src/bin.ts', 'src/db/index.ts'],
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
        from: ['./src/mailer/templates/**/*'],
        to: ['./templates'],
        keepStructure: true,
      },
    }),
  ]),
})

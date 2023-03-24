const pkgJson = require('@npmcli/package-json')
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
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  outdir: 'dist',
  platform: 'browser',
  format: 'cjs',
  plugins: buildShallow ? [nodeExternalsPlugin()] : [],
})

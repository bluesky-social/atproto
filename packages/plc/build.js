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
  entryPoints: [
    'src/index.ts',
    'src/bin.ts',
    'src/server/index.ts',
    'src/server/db.ts',
    'src/client/index.ts',
  ],
  bundle: true,
  sourcemap: true,
  treeShaking: true,
  outdir: 'dist',
  platform: 'node',
  assetNames: 'src/static',
  plugins: buildShallow ? [nodeExternalsPlugin()] : [],
  external: [
    'better-sqlite3',
    'level',
    'classic-level',
    // Referenced in pg driver, but optional and we don't use it
    'pg-native',
  ],
})

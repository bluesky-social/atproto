const pkgJson = require('@npmcli/package-json')
const { nodeExternalsPlugin } = require('esbuild-node-externals')

const buildShallow = process.env.ATP_BUILD_SHALLOW === 'true'

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: [
      'src/bin.ts',
      'src/server/index.ts',
      'src/server/db.ts',
      'src/client/index.ts',
    ],
    bundle: true,
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
  .then(() => (buildShallow ? pkgJson.load(__dirname) : null))
  .then((pkg) => (pkg?.update({ main: 'dist/index.js' }), pkg?.save()))

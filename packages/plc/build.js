const { nodeExternalsPlugin } = require('esbuild-node-externals')

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
    plugins: process.env.ATP_BUILD_SHALLOW ? [nodeExternalsPlugin()] : [],
    external: [
      'better-sqlite3',
      'level',
      'classic-level',
      // Referenced in pg driver, but optional and we don't use it
      'pg-native',
    ],
  })
  .catch(() => process.exit(1))

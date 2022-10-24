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
    external: [
      'better-sqlite3',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
      // Referenced in pg driver, but optional and we don't use it
      'pg-native',
    ],
  })
  .catch(() => process.exit(1))

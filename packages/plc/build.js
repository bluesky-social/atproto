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
      './node_modules/better-sqlite3/*',
      '../../node_modules/better-sqlite3/*',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: [
      'src/index.ts',
      'src/server.ts',
      'src/db/index.ts',
    ],
    bundle: true,
    treeShaking: true,
    outdir: 'dist',
    platform: 'node',
    assetNames: 'src/static',
    external: [
      './node_modules/sqlite3/*',
      '../../node_modules/sqlite3/*',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))

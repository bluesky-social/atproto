require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/bin.ts', 'src/db/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      '../plc/node_modules/@mapbox/node-pre-gyp/*',
      './node_modules/sqlite3/*',
      '../node_modules/sqlite3/*',
      '../../node_modules/sqlite3/*',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))

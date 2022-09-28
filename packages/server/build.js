require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/bin.ts', 'src/db/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      'mock-aws-s3',
      'aws-sdk',
      'nock',
      './node_modules/sqlite3/*',
      '../node_modules/sqlite3/*',
      '../../node_modules/sqlite3/*',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))

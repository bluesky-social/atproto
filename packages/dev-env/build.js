require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/cli.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      './node_modules/sqlite3/*',
      '../../node_modules/level/*',
      '../../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))

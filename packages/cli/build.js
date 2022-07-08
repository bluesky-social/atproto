require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/bin.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: ['level', 'classic-level'],
  })
  .catch(() => process.exit(1))

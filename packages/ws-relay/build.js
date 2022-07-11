require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/bin.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
  })
  .catch(() => process.exit(1))

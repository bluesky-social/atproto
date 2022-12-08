const { copy } = require('esbuild-plugin-copy')

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/cli.ts'],
    bundle: true,
    sourcemap: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      'better-sqlite3',
      // Referenced in pg driver, but optional and we don't use it
      'pg-native',
      'sharp',
    ],
    plugins: [
      copy({
        assets: {
          from: ['../pds/src/mailer/templates/**/*'],
          to: ['./templates'],
          keepStructure: true,
        },
      }),
    ],
  })
  .catch(() => process.exit(1))

const { copy } = require('esbuild-plugin-copy')

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/bin.ts', 'src/db/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      'better-sqlite3',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
      // Referenced in pg driver, but optional and we don't use it
      'pg-native',
    ],
    plugins: [
      copy({
        assets: {
          from: ['./src/mailer/templates/**/*'],
          to: ['./templates'],
          keepStructure: true,
        },
      }),
    ],
  })
  .catch(() => process.exit(1))

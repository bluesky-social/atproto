const { copy } = require('esbuild-plugin-copy')

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/cli.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      '../plc/node_modules/better-sqlite3/*',
      '../server/node_modules/better-sqlite3/*',
      '../../node_modules/classic-level/*',
      // Referenced in pg driver, but optional and we don't use it
      'pg-native',
    ],
    plugins: [
      copy({
        assets: {
          from: ['../server/src/mailer/templates/**/*'],
          to: ['./templates'],
          keepStructure: true,
        },
      }),
    ],
  })
  .catch(() => process.exit(1))

const { copy } = require('esbuild-plugin-copy')

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/cli.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      './node_modules/sqlite3/*',
      '../server/node_modules/@mapbox/node-pre-gyp/*',
      '../plc/node_modules/@mapbox/node-pre-gyp/*',
      '../server/node_modules/sqlite3/*',
      '../../node_modules/classic-level/*',
    ],
    plugins: [
      copy({
        // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
        // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
        assets: {
          from: ['../server/src/mailer/templates/**/*'],
          to: ['./templates'],
          keepStructure: true,
        },
      }),
    ],
  })
  .catch(() => process.exit(1))

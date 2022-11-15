const { copy } = require('esbuild-plugin-copy')
const { nodeExternalsPlugin } = require('esbuild-node-externals')

require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts', 'src/bin.ts', 'src/db/index.ts'],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    external: [
      'better-sqlite3',
      'level',
      'classic-level',
      // Referenced in pg driver, but optional and we don't use it
      'pg-native',
    ],
    plugins: []
      .concat(process.env.ATP_BUILD_SHALLOW ? [nodeExternalsPlugin()] : [])
      .concat([
        copy({
          assets: {
            from: ['./src/mailer/templates/**/*'],
            to: ['./templates'],
            keepStructure: true,
          },
        }),
      ]),
  })
  .catch(() => process.exit(1))

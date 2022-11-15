const pkgJson = require('@npmcli/package-json')
const { copy } = require('esbuild-plugin-copy')
const { nodeExternalsPlugin } = require('esbuild-node-externals')

const buildShallow = process.env.ATP_BUILD_SHALLOW === 'true'

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
    plugins: [].concat(buildShallow ? [nodeExternalsPlugin()] : []).concat([
      copy({
        assets: {
          from: ['./src/mailer/templates/**/*'],
          to: ['./templates'],
          keepStructure: true,
        },
      }),
    ]),
  })
  .then(() => (buildShallow ? pkgJson.load(__dirname) : null))
  .then((pkg) => (pkg?.update({ main: 'dist/index.js' }), pkg?.save()))

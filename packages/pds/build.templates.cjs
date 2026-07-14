/* eslint-env node */

const hbsPlugin = require('esbuild-plugin-handlebars')
const { globSync } = require('glob')

require('esbuild').build({
  logLevel: 'info',
  watch: process.argv.includes('--watch'),
  entryPoints: globSync('src/**/*.hbs'),
  sourcemap: true,
  outdir: 'dist/mailer/templates',
  platform: 'node',
  format: 'esm',
  bundle: true,
  plugins: [
    hbsPlugin({
      filter: /\.(hbs)$/,
      additionalHelpers: {},
      precompileOptions: {},
    }),
  ],
})

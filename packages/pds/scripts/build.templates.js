import { globSync } from 'node:fs'
import { build } from 'esbuild'
import hbsPlugin from 'esbuild-plugin-handlebars'

build({
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

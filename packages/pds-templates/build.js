const hbsPlugin = require('esbuild-plugin-handlebars')

require('esbuild').build({
  logLevel: 'info',
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  outdir: 'dist',
  platform: 'node',
  external: ['handlebars', 'tslib'],
  plugins: [
    hbsPlugin({
      filter: /\.(hbs|handlebars)$/,
      additionalHelpers: {},
      precompileOptions: {},
    }),
  ],
})

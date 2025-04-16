/* eslint-env node */

const { default: commonjs } = require('@rollup/plugin-commonjs')
const { default: html, makeHtmlAttributes } = require('@rollup/plugin-html')
const { default: json } = require('@rollup/plugin-json')
const { default: nodeResolve } = require('@rollup/plugin-node-resolve')
const { default: swc } = require('@rollup/plugin-swc')
const { defineConfig } = require('rollup')
const {
  bundleManifest,
} = require('@atproto-labs/rollup-plugin-bundle-manifest')
const postcss = ((m) => m.default || m)(require('rollup-plugin-postcss'))
const serve = ((m) => m.default || m)(require('rollup-plugin-serve'))

module.exports = defineConfig((commandLineArguments) => {
  const NODE_ENV =
    process.env['NODE_ENV'] ??
    (commandLineArguments.watch ? 'development' : 'production')

  const devMode = NODE_ENV === 'development'

  return {
    input: 'src/main.tsx',
    output: {
      manualChunks: undefined,
      sourcemap: true,
      file: 'dist/main.js',
      format: 'iife',
    },
    plugins: [
      {
        name: 'resolve-swc-helpers',
        resolveId(src) {
          // For some reason, "nodeResolve" doesn't resolve these:
          if (src.startsWith('@swc/helpers/')) return require.resolve(src)
        },
      },
      nodeResolve({ preferBuiltins: false, browser: true }),
      commonjs(),
      json(),
      postcss({ config: true, extract: true, minimize: false }),
      swc({
        swc: {
          swcrc: false,
          configFile: false,
          sourceMaps: true,
          minify: !devMode,
          jsc: {
            minify: {
              compress: {
                module: true,
                unused: true,
              },
              mangle: true,
            },
            externalHelpers: true,
            target: 'es2020',
            parser: { syntax: 'typescript', tsx: true },
            transform: {
              useDefineForClassFields: true,
              react: { runtime: 'automatic' },
              optimizer: {
                simplify: true,
                globals: {
                  vars: { 'process.env.NODE_ENV': JSON.stringify(NODE_ENV) },
                },
              },
            },
          },
        },
      }),
      html({
        title: 'OAuth Client Example',
        template: ({ attributes, files, meta, publicPath, title }) => `
          <!DOCTYPE html>
          <html${makeHtmlAttributes(attributes.html)}>
          <head>
            ${meta
              .map((attrs) => `<meta${makeHtmlAttributes(attrs)}>`)
              .join('\n')}
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${title}</title>
            ${files.css
              .map(
                (asset) =>
                  `<link${makeHtmlAttributes({
                    ...attributes.link,
                    rel: 'stylesheet',
                    href: `${publicPath}${asset.fileName}`,
                  })}>`,
              )
              .join('\n')}
          </head>
          <body class="bg-white dark:bg-slate-800">
            <div id="root"></div>
            ${files.js
              .map(
                (asset) =>
                  `<script${makeHtmlAttributes({
                    ...attributes.script,
                    src: `${publicPath}${asset.fileName}`,
                  })}></script>`,
              )
              .join('\n')}
          </body>
          </html>
        `,
      }),
      bundleManifest({ name: 'files.json', data: true }),

      commandLineArguments.watch &&
        serve({
          contentBase: 'dist',
          port: 8080,
          headers: { 'Cache-Control': 'no-store' },
        }),
    ],
    onwarn(warning, warn) {
      // 'use client' directives are fine
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
      warn(warning)
    },
  }
})

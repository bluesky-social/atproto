/* eslint-env node */

const { defineConfig } = require('rollup')

const {
  default: manifest,
} = require('@atproto-labs/rollup-plugin-bundle-manifest')
const { default: commonjs } = require('@rollup/plugin-commonjs')
const { default: html, makeHtmlAttributes } = require('@rollup/plugin-html')
const { default: json } = require('@rollup/plugin-json')
const { default: nodeResolve } = require('@rollup/plugin-node-resolve')
const { default: replace } = require('@rollup/plugin-replace')
const { default: terser } = require('@rollup/plugin-terser')
const { default: typescript } = require('@rollup/plugin-typescript')
const postcss = ((m) => m.default || m)(require('rollup-plugin-postcss'))
const serve = ((m) => m.default || m)(require('rollup-plugin-serve'))

module.exports = defineConfig((commandLineArguments) => {
  const NODE_ENV =
    process.env['NODE_ENV'] ??
    (commandLineArguments.watch ? 'development' : 'production')

  const minify = NODE_ENV !== 'development'

  return {
    input: 'src/main.tsx',
    output: {
      manualChunks: undefined,
      sourcemap: true,
      file: 'dist/main.js',
      format: 'iife',
    },
    plugins: [
      nodeResolve({ preferBuiltins: false, browser: true }),
      commonjs(),
      json(),
      postcss({ config: true, extract: true, minimize: false }),
      typescript({
        tsconfig: './tsconfig.build.json',
        outputToFilesystem: true,
      }),
      replace({
        preventAssignment: true,
        values: { 'process.env.NODE_ENV': JSON.stringify(NODE_ENV) },
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
      minify && terser({}),
      manifest({ name: 'files.json', data: true }),

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

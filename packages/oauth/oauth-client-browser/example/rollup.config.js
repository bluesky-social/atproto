/* eslint-env node */

import { defineConfig } from 'rollup'

import commonjs from '@rollup/plugin-commonjs'
import html, { makeHtmlAttributes } from '@rollup/plugin-html'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import typescript from '@rollup/plugin-typescript'
import postcss from 'rollup-plugin-postcss'
import serve from 'rollup-plugin-serve'

export default defineConfig((commandLineArguments) => {
  const NODE_ENV =
    process.env['NODE_ENV'] ??
    (commandLineArguments.watch ? 'development' : 'production')

  return {
    input: 'src/main.tsx',
    output: { dir: 'dist', sourcemap: true },
    plugins: [
      nodeResolve({ preferBuiltins: false, browser: true }),
      commonjs(),
      postcss({ config: true, extract: true, minimize: false }),
      json(),
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
        template: (templateOptions) => {
          // https://github.com/rollup/plugins/pull/1718
          if (!templateOptions) throw new Error('No template options provided')
          const { attributes, files, meta, publicPath, title } = templateOptions

          return `
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
            `
        },
      }),
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

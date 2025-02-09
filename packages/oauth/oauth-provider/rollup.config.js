/* eslint-env node */

const { default: commonjs } = require('@rollup/plugin-commonjs')
const { default: nodeResolve } = require('@rollup/plugin-node-resolve')
const { default: replace } = require('@rollup/plugin-replace')
const { default: terser } = require('@rollup/plugin-terser')
const { default: typescript } = require('@rollup/plugin-typescript')
const { defineConfig } = require('rollup')
const {
  default: manifest,
} = require('@atproto-labs/rollup-plugin-bundle-manifest')
const postcss = ((m) => m.default || m)(require('rollup-plugin-postcss'))

module.exports = defineConfig((commandLineArguments) => {
  const NODE_ENV =
    process.env['NODE_ENV'] ??
    (commandLineArguments.watch ? 'development' : 'production')

  const minify = NODE_ENV !== 'development'

  return {
    input: 'src/assets/app/main.tsx',
    output: {
      manualChunks: undefined,
      sourcemap: true,
      file: 'dist/assets/app/main.js',
      format: 'iife',
    },
    plugins: [
      nodeResolve({ preferBuiltins: false, browser: true }),
      commonjs(),
      postcss({ config: true, extract: true, minimize: minify }),
      typescript({
        tsconfig: './tsconfig.frontend.json',
        outputToFilesystem: true,
      }),
      replace({
        preventAssignment: true,
        values: { 'process.env.NODE_ENV': JSON.stringify(NODE_ENV) },
      }),
      // Change `data` to `true` to include assets data in the manifest,
      // allowing for easier bundling of the backend code (eg. using esbuild) as
      // bundlers know how to bundle JSON files but not how to bundle assets
      // referenced at runtime.
      manifest({ data: false }),
      minify && terser({}),
    ],
    onwarn(warning, warn) {
      // 'use client' directives are fine
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
      warn(warning)
    },
  }
})

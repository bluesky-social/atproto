/* eslint-env node */

const { defineConfig } = require('rollup')

const { default: manifest } = require('@atproto/rollup-plugin-bundle-manifest')
const { default: commonjs } = require('@rollup/plugin-commonjs')
const { default: nodeResolve } = require('@rollup/plugin-node-resolve')
const { default: replace } = require('@rollup/plugin-replace')
const { default: terser } = require('@rollup/plugin-terser')
const { default: typescript } = require('@rollup/plugin-typescript')
const postcss = ((m) => m.default || m)(require('rollup-plugin-postcss'))

const NODE_ENV =
  process.env['NODE_ENV'] === 'development' ? 'development' : 'production'
const devMode = NODE_ENV === 'development'

module.exports = defineConfig({
  input: 'src/app/main.tsx',
  output: {
    manualChunks: undefined,
    sourcemap: devMode,
    file: 'dist/app/main.js',
    format: 'iife',
  },
  plugins: [
    nodeResolve({ preferBuiltins: false, browser: true }),
    commonjs(),
    postcss({ config: true, extract: true, minimize: !devMode }),
    typescript({
      tsconfig: './tsconfig.frontend.json',
      outputToFilesystem: true,
    }),
    replace({
      preventAssignment: true,
      values: { 'process.env.NODE_ENV': JSON.stringify(NODE_ENV) },
    }),
    manifest(),
    !devMode && terser({}),
  ],
})

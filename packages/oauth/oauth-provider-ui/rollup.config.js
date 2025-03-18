/* eslint-env node */

const { default: commonjs } = require('@rollup/plugin-commonjs')
const {
  default: dynamicImportVars,
} = require('@rollup/plugin-dynamic-import-vars')
const { default: nodeResolve } = require('@rollup/plugin-node-resolve')
const { default: swc } = require('@rollup/plugin-swc')
const {
  default: manifest,
} = require('@atproto-labs/rollup-plugin-bundle-manifest')
const postcss = ((m) => m.default || m)(require('rollup-plugin-postcss'))

/**
 * @type {import('rollup').RollupOptionsFunction}
 */
module.exports = (commandLineArguments) => {
  const NODE_ENV =
    process.env['NODE_ENV'] ??
    (commandLineArguments.watch ? 'development' : 'production')

  const devMode = NODE_ENV === 'development'

  return {
    input: [`src/authorization-page.tsx`, `src/error-page.tsx`],
    output: {
      manualChunks: undefined,
      sourcemap: true,
      dir: 'dist/assets',
      format: 'module',
      entryFileNames: devMode ? '[name]-[hash].js' : '[hash].js',
    },
    plugins: [
      {
        name: 'resolve-swc-helpers',
        resolveId(src) {
          // For some reason, "nodeResolve" doesn't resolve these:
          if (src.startsWith('@swc/helpers/')) return require.resolve(src)
        },
      },
      nodeResolve({
        preferBuiltins: false,
        browser: true,
        exportConditions: ['browser', 'module', 'import', 'default'],
      }),
      commonjs(),
      postcss({ config: true, extract: true, minimize: !devMode }),
      swc({
        swc: {
          swcrc: false,
          configFile: false,
          sourceMaps: true,
          minify: !devMode,
          jsc: {
            experimental: {
              // @NOTE Because of the experimental nature of SWC plugins, A
              // very particular version of @swc/core needs to be used. The
              // link below allows to determine with version of @swc/core is
              // compatible based on the version of @lingui/swc-plugin used
              // (click on the swc_core version in the right column to see
              // which version of the @swc/core is compatible)
              //
              // https://github.com/lingui/swc-plugin?tab=readme-ov-file#compatibility
              plugins: [['@lingui/swc-plugin', {}]],
            },
            minify: {
              compress: true,
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
                  vars: {
                    'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
                  },
                },
              },
            },
          },
        },
      }),
      dynamicImportVars({ errorWhenNoFilesFound: true }),

      // Change `data` to `true` to include assets data in the manifest,
      // allowing for easier bundling of the backend code (eg. using esbuild) as
      // bundlers know how to bundle JSON files but not how to bundle assets
      // referenced at runtime.
      manifest({ data: false }),
    ],
    onwarn(warning, warn) {
      // 'use client' directives are fine
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
      warn(warning)
    },
  }
}

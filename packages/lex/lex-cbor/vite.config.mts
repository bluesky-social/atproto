import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }

// We rely on a bundler to handle bundling of the "cborg" package. This is
// required because "cborg" is an ESM-only package that uses "exports" fields
// in its package.json, which causes issues when trying to import it directly
// in a CJS context without bundling.

// Whenever this package is converted to ESM only, we can likely remove this
// bundling step.

// Prepend @ts-nocheck to bundled output so tsc (with checkJs: true) does not
// type-check the generated JS files.
function tsNoCheck(): Plugin {
  return {
    name: 'ts-nocheck-banner',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk') {
          chunk.code = '// @ts-nocheck\n' + chunk.code
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [tsNoCheck()],
  build: {
    minify: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => {
        switch (format) {
          case 'es':
            return 'index.mjs'
          case 'cjs':
            return 'index.cjs'
          default:
            return `index.${format}.js`
        }
      },
    },
    rollupOptions: {
      // Only devpendencies should be bundled
      external: Object.keys(pkg.dependencies),
    },
  },
})

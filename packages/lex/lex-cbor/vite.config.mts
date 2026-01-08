import path from 'node:path'
import { defineConfig } from 'vite'
import pkg from './package.json' assert { type: 'json' }

// We rely on a bundler to handle bundling of the "cborg" package. This is
// required because "cborg" is an ESM-only package that uses "exports" fields
// in its package.json, which causes issues when trying to import it directly
// in a CJS context without bundling.

// Whenever this package is converted to ESM only, we can likely remove this
// bundling step.

export default defineConfig({
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

import path from 'node:path'
import { defineConfig } from 'vite'

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
      // We only want to bundle cborg because it's ESM
      external: [/@atproto/, /multiformats/, 'tslib'],
    },
  },
})

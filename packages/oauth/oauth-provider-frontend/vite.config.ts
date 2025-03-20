import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import manifest from '@atproto-labs/rollup-plugin-bundle-manifest'
import react from '@vitejs/plugin-react-swc'
import { lingui } from '@lingui/vite-plugin'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'src',
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
    },
  },
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
    tailwindcss(),
  ],
  build: {
    emptyOutDir: true,
    outDir: resolve(__dirname, './dist'),
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: '[name]-[format]-[hash].js',
        chunkFileNames: '[name]-[format]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
      plugins: [
        /*
         * Change `data` to `true` to include assets data in the manifest,
         * allowing for easier bundling of the backend code (eg. using esbuild)
         * as bundlers know how to bundle JSON files but not how to bundle
         * assets referenced at runtime.
         */
        // @ts-ignore TODO figure out import
        manifest.default({ data: false }),
      ],
    },
  },
})

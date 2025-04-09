import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import manifest from '@atproto-labs/rollup-plugin-bundle-manifest'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: './src',
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
    },
  },
  plugins: [
    TanStackRouterVite({
      target: 'react',
      routesDirectory: './src/routes',
    }),
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
    tailwindcss(),
  ],
  build: {
    emptyOutDir: false,
    outDir: './dist',
    sourcemap: true,
    rollupOptions: {
      input: ['./src/account-page.tsx'],
      output: {
        manualChunks: undefined,
        format: 'module',
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
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
    commonjsOptions: {
      include: [/node_modules/, /oauth-provider-api/, /syntax/],
    },
  },
  optimizeDeps: {
    include: ['@atproto/oauth-provider-api', '@atproto/syntax'],
  },
})

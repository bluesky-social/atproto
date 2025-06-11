import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { bundleManifest } from '@atproto-labs/rollup-plugin-bundle-manifest'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
    },
  },
  plugins: [
    TanStackRouterVite({ target: 'react' }),
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
      plugins: [bundleManifest()],
    },
    commonjsOptions: {
      include: [/node_modules/, /oauth-provider-api/, /syntax/],
    },
  },
  optimizeDeps: {
    include: ['@atproto/oauth-provider-api', '@atproto/syntax'],
  },
})

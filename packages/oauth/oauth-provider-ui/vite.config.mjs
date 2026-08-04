/// <reference types="vitest/config" />

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { bundleManifest } from '@atproto-labs/rolldown-plugin-bundle-manifest'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
    },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui({ cwd: __dirname }),
    tailwindcss(),
  ],
  build: {
    emptyOutDir: false,
    outDir: './dist',
    sourcemap: true,
    rolldownOptions: {
      input: [
        './src/account-page.tsx',
        './src/authorization-page.tsx',
        './src/cookie-error-page.tsx',
        './src/error-page.tsx',
      ],
      output: {
        manualChunks: undefined,
        format: 'module',
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
      plugins: [bundleManifest()],
    },
    // this
    // @NOTE the "env" arg (when defineConfig is used with a function) does not
    // allow to detect watch mode. We do want to set the "buildDelay" though to
    // avoid i18n compilation to trigger too many build (and restart of
    // dependent services).
    watch: process.argv.includes('--watch')
      ? { buildDelay: 500, clearScreen: false }
      : undefined,
  },
  test: {},
})

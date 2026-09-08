/// <reference types="vitest/config" />

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { linguiMacroSwcPlugin } from '@lingui/swc-plugin/options'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { ASSETS_ENDPOINT_PREFIX } from '@atproto/oauth-provider-api'
import { bundleManifest } from '@atproto-labs/rolldown-plugin-bundle-manifest'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * The account page owns every path under `/account`, as it does when the PDS
 * serves it. The dev server is a plain multi-page app, so without this a deep
 * link — or a refresh on one — falls through to the mock index instead of
 * reaching the router.
 *
 * @returns {import('vite').Plugin}
 */
const mockAccountPaths = () => ({
  name: 'mock-account-paths',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [pathname] = (req.url ?? '').split('?')
      if (pathname === '/account' || pathname.startsWith('/account/')) {
        req.url = '/account-page.html'
      }
      next()
    })
  },
})

export default defineConfig({
  // The built assets are served by the OAuth provider under a path prefix, not
  // from the site root. Only the entry `<script>`/`<link>` URLs are rewritten
  // to that prefix server-side; the inter-chunk imports and code-split CSS
  // preloads are baked in at build time. Pinning `base` to the serving prefix
  // makes those absolute URLs resolve to the assets endpoint instead of the
  // origin root (where they would 404).
  base: `${ASSETS_ENDPOINT_PREFIX}/`,
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
    },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  plugins: [
    // @NOTE Must come before the React plugin: it rewrites the route files
    // (splitting each `component` into its own chunk) before they are compiled.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react({
      plugins: [linguiMacroSwcPlugin({}, { cwd: __dirname })],
    }),
    lingui({ cwd: __dirname }),
    tailwindcss(),
    mockAccountPaths(),
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

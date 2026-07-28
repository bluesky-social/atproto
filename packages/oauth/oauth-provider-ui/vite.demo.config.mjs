import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// Cloudflare Pages serves an existing file first and only falls back to these
// rules, so the other entry points are unaffected. Only the account manager
// needs it: account-page.html rewrites the URL to /account on load and then
// TanStack routes on real paths, so a reload at /account/manage would 404.
const redirects = [
  '/account /account-page.html 200',
  '/account/* /account-page.html 200',
  '',
].join('\n')

const emitRedirects = () => ({
  name: 'emit-redirects',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_redirects', source: redirects })
  },
})

const __dirname = dirname(fileURLToPath(import.meta.url))

// Static build of the mock harness — the same four HTML entry points `dev:ui`
// serves, bundled so they can be hosted. Separate from vite.config.mjs, whose
// inputs are the `.tsx` entries the PDS consumes.
export default defineConfig({
  // Absolute, not './': the SPA fallback serves account-page.html at nested
  // paths like /account/manage, where relative asset URLs would resolve to
  // /account/assets/... and 404 into the fallback HTML.
  base: '/',
  resolve: {
    alias: { '#': resolve(__dirname, './src') },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  plugins: [
    react({ plugins: [['@lingui/swc-plugin', {}]] }),
    lingui({ cwd: __dirname }),
    tailwindcss(),
    emitRedirects(),
  ],
  build: {
    // The mock harness inlined in the HTML uses top-level await.
    target: 'esnext',
    outDir: './dist-demo',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        account: resolve(__dirname, 'account-page.html'),
        authorization: resolve(__dirname, 'authorization-page.html'),
        error: resolve(__dirname, 'error-page.html'),
        cookie: resolve(__dirname, 'cookie-error-page.html'),
      },
    },
  },
})

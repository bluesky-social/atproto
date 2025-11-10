import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { bundleManifest } from '@atproto-labs/rollup-plugin-bundle-manifest'

export default defineConfig({
  plugins: [
    //
    react({ plugins: [['@lingui/swc-plugin', {}]] }),
    tailwindcss(),
  ],
  build: {
    emptyOutDir: true,
    outDir: './dist',
    sourcemap: true,
    commonjsOptions: {
      include: [
        /node_modules/,
        /did/,
        /oauth-client/,
        /oauth-client-browser/,
        /oauth-scopes/,
        /lex/,
        /lex-client/,
        /lex-data/,
        /lex-schema/,
        /syntax/,
      ],
    },
    rollupOptions: {
      plugins: [bundleManifest({ name: 'files.json', data: true })],
    },
  },
  // Needed because this is a monorepo (and packages are CommonJS)
  optimizeDeps: {
    include: [
      // @NOTEs Only explicit dependencies of this package should be included
      // here
      '@atproto/lex',
      '@atproto/oauth-client-browser',
    ],
  },
})

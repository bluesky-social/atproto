import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages/],
    },
  },
  optimizeDeps: {
    include: [
      '@atproto/api',
      '@atproto-labs/oauth-client',
      '@atproto-labs/oauth-client-browser',
      '@atproto-labs/oauth-client-metadata',
      '@atproto-labs/oauth-server-metadata',
      '@atproto/xrpc',
    ],
  },
  plugins: [react()],
})

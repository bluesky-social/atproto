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
      '@atproto/oauth-client',
      '@atproto/oauth-client-browser',
      '@atproto/oauth-client-metadata',
      '@atproto/oauth-server-metadata',
      '@atproto/xrpc',
    ],
  },
  plugins: [react()],
})

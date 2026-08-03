import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { bundleManifest } from '@atproto-labs/rollup-plugin-bundle-manifest'

export default defineConfig({
  plugins: [
    //
    react(),
    tailwindcss(),
  ],
  build: {
    emptyOutDir: true,
    outDir: './dist',
    sourcemap: true,
    rolldownOptions: {
      plugins: [bundleManifest({ name: 'files.json', data: true })],
    },
    minify: false,
  },
})

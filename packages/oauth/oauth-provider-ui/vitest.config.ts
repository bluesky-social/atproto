import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react-swc'
import { defineProject } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineProject({
  // The `#/` subpath alias is declared in tsconfig `paths` and in
  // vite.config.mjs, neither of which vitest reads. Without it, any module
  // under test that imports `#/...` fails to resolve.
  resolve: {
    alias: {
      '#': resolve(__dirname, './src'),
    },
  },
  // Lingui's `msg` / `t` macros are compile-time only — they must be
  // transformed away before they run, or importing `@lingui/core/macro`
  // throws at runtime.
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
  ],
  test: {},
})

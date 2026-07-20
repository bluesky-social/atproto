import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // or 'istanbul'
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/src/lexicons/**',
        '**/tests/**',
      ],
    },
    projects: [
      'packages/aws',
      'packages/internal/handle-resolver',
      'packages/lex/*',
      'packages/oauth/oauth-client',
      'packages/syntax',
      'packages/tap',

      // The following packages use vitest but require dev-infra to be started &
      // stopped between runs, we don't enable it here (when running "pnpm
      // test:unit" or the "vitest.explorer" VSCode extension). Use "pnpm test"
      // from the package root instead.

      // 'packages/bsky',
    ],
  },
})

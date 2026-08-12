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
      'packages/common',
      'packages/internal/*',
      'packages/lex/*',
      'packages/lexicon-resolver',
      'packages/oauth/*',
      'packages/syntax',
      'packages/tap',
      'packages/ws-client',

      // The following packages use vitest but require dev-infra to be started &
      // stopped between runs, we don't enable it here (when running "pnpm
      // test:unit" or the "vitest.explorer" VSCode extension). Use "pnpm test"
      // from the package root instead.

      // 'packages/bsky',
    ],
  },
})

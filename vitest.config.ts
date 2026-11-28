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
      'packages/api',
      'packages/aws',
      'packages/common',
      'packages/common-web',
      'packages/crypto',
      'packages/did',
      'packages/identity',
      'packages/internal/*',
      'packages/lex/*',
      'packages/lex-cli',
      'packages/lexicon',
      'packages/lexicon-resolver',
      'packages/oauth/*',
      'packages/repo',
      'packages/syntax',
      'packages/tap',
      'packages/ws-client',
      'packages/xrpc-server',

      // The following packages use vitest but require dev-infra to be started &
      // stopped between runs, we don't enable them here (when running "pnpm
      // test:unit" or the "vitest.explorer" VSCode extension). Use "pnpm
      // test:integration" from the repo root, or "pnpm test" from the package
      // root, instead.

      // 'packages/bsky',
      // 'packages/ozone',
    ],
  },
})

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
      'packages/sync',
      'packages/syntax',
      'packages/tap',
      'packages/ws-client',
      'packages/xrpc-server',

      // Packages whose tests require dev-infra to be started & stopped between
      // runs are not enabled here (when running "pnpm test:unit" or the
      // "vitest.explorer" VSCode extension). They are listed in
      // vitest.integration.config.ts: use "pnpm test:integration" from the repo
      // root, or "pnpm test" from the package root, instead.
    ],
  },
})

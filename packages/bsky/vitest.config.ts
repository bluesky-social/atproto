import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    testTimeout: 60000,
    setupFiles: ['../../test.setup.ts'],
    exclude: [
      'dist/**',
      'node_modules/**',
      // Requires vi.mock() to intercept CJS require() in dist/, which only
      // works once @atproto/bsky has "type": "module" (deferred to ESM branch)
      'tests/views/age-assurance-v2.test.ts',
    ],
  },
})

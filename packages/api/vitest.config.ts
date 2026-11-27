import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})

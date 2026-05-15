import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    testTimeout: 60000,
    setupFiles: ['../../jest.setup.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
})

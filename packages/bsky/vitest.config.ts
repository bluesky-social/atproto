import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    testTimeout: 60000,
    setupFiles: ['dotenv/config'],
    exclude: ['dist/**', 'node_modules/**'],
  },
})

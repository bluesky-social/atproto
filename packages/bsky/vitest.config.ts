import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    testTimeout: 60000,
    hookTimeout: 40000, // seeding can take a while
    exclude: ['dist/**', 'node_modules/**'],
  },
})

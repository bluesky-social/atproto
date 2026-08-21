import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    exclude: ['dist/**', 'node_modules/**'],
  },
})

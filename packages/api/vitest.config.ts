import { configDefaults, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    // Colocated test helpers
    exclude: [...configDefaults.exclude, '**/_*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})

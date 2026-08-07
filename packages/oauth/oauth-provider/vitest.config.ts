import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    // This package builds to `dist/` in place, so without this the compiled
    // copy of every test is discovered and run a second time.
    include: ['src/**/*.test.ts'],
  },
})

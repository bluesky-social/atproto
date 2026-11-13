import { defineProject } from 'vitest/config'

export default defineProject({
  resolve: {
    alias: {
      // Tests import source files directly (not built dist output), so mirror
      // the package.json `imports` condition for Node.js here.
      '#transport': new URL(
        './src/transport/node-transport.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {},
})

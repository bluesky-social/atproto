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
    projects: ['packages/lex/*', 'packages/syntax', 'packages/tap'],
  },
})

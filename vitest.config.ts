import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // or 'istanbul'
      include: ['src/**/*.ts'],
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/src/lexicons/**',
        '**/tests/lexicons/**',
      ],
    },
    projects: ['packages/lex/*'],
  },
})

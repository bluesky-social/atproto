import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000, // seeding can take a while
    server: {
      deps: {
        // @NOTE Workspace packages resolve to `packages/*/dist`, outside
        // `node_modules`, so vitest would otherwise transform and evaluate the
        // whole dev-env graph through its module runner. Load it natively.
        external: [/\/packages\/.+\/dist\//],
      },
    },
    // @NOTE Import the dev-env graph once per worker, not once per file.
    // Module state outlives the file: restore anything a test patches.
    isolate: false,
  },
})

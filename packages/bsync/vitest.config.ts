import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Colocated test helpers
    exclude: [...configDefaults.exclude, '**/_*.test.ts'],
    server: {
      deps: {
        // @NOTE Workspace packages resolve to `packages/*/dist`, outside
        // `node_modules`, so vitest would otherwise transform and evaluate
        // them through its module runner. Load them natively.
        external: [/\/packages\/.+\/dist\//],
      },
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/**/*.test.ts'],
          // @NOTE Import the module graph once per worker, not once per file.
          // Module state outlives the file: restore anything a test patches.
          isolate: false,
        },
      },
    ],
  },
})

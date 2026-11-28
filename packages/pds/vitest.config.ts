import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000, // booting a PDS and seeding can take a while
    exclude: ['dist/**', 'node_modules/**'],
    server: {
      deps: {
        // @NOTE Workspace packages resolve to `packages/*/dist`, outside
        // `node_modules`, so vitest would otherwise transform and evaluate the
        // whole dev-env graph through its module runner. Load it natively.
        external: [
          /\/packages\/.+\/dist\//,
          // Outside `dist`, and imports a `dist` JSON file, which vitest would
          // externalize without its `type: 'json'` import attribute.
          /\/packages\/oauth\/oauth-client-browser-example\/server\.js$/,
        ],
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
          // @NOTE Import the dev-env graph once per worker, not once per file.
          // Module state outlives the file: restore anything a test patches.
          isolate: false,
        },
      },
    ],
  },
})

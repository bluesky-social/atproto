import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    server: {
      deps: {
        // @NOTE Workspace packages resolve to `packages/*/dist`, outside
        // `node_modules`, so vitest would otherwise transform the whole service
        // graph that src/network.ts imports. Load it natively.
        external: [/\/packages\/.+\/dist\//],
      },
    },
  },
})

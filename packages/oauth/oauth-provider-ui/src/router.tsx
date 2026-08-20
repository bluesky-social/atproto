import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.ts'

export const queryClient = new QueryClient()

export const router = createRouter({
  routeTree,
  context: {
    // @NOTE Filled in by `<RouterProvider context={…}/>`: the session state
    // and the API client live in React, above the router.
    auth: undefined!,
    api: undefined!,
    queryClient,
  },
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

import { createRouter } from '@tanstack/react-router'
import { route, routes } from './route.tsx'

export const router = createRouter({ routeTree: route.addChildren(routes) })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

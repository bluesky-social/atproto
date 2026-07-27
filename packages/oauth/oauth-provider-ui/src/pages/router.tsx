import { createRouter } from '@tanstack/react-router'
import { buildRoutes as buildAccountRoutes } from './account/(authenticated)/route.tsx'
import { Route as ResetPasswordRoute } from './account/(unauthenticated)/reset-password/route.tsx'
import { RootRoute } from './route.tsx'

// @NOTE `buildAccountRoutes` accepts an optional second argument of extra
// pages. The purpose of that mechanism is to (eventually!) allow adding custom
// pages (or changing existing pages) to the account manager, for specific
// deployments, without having to fork the entire package. It previously carried
// a hidden "/branding" page rendering a colour-palette demo; that demo went
// with the neutral theme, but the extension point itself remains.
const authenticatedRoutes = buildAccountRoutes('/account')

export const router = createRouter({
  routeTree: RootRoute.addChildren([
    ...authenticatedRoutes,
    ResetPasswordRoute,
  ]),
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { route as parentRoute } from '../route.tsx'
import { routes as resetPasswordRoutes } from './reset-password/route.tsx'
import { routes as signInRoutes } from './sign-in/route.tsx'
import { routes as signUpRoutes } from './sign-up/route.tsx'
import { routes as uRoutes } from './u/$accountId/route.tsx'

export const route = createRoute({
  getParentRoute: () => parentRoute,
  path: '/account',
  component: lazyRouteComponent(() => import('./page.tsx')),
})

export const routes = [
  route,
  ...signInRoutes,
  ...signUpRoutes,
  ...resetPasswordRoutes,
  ...uRoutes,
] as const

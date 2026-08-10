import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { route as parentRoute } from '../route.tsx'

export const route = createRoute({
  getParentRoute: () => parentRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./page.tsx')),
})

export const routes = [route] as const

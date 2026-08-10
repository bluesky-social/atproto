import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { ErrorView } from '#/components/error-view'
import { route as parentRoute } from '../../route.tsx'

export const route = createRoute({
  getParentRoute: () => parentRoute,
  path: '/account/reset-password',
  component: lazyRouteComponent(() => import('./page.tsx')),
  errorComponent: ErrorView,
})

export const routes = [route] as const

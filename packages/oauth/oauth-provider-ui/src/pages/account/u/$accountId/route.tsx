import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { route as parentRoute } from '../../../route.tsx'
import { routes as aboutRoutes } from './about/route.tsx'
import { routes as appsRoutes } from './apps/route.tsx'
import { routes as devicesRoutes } from './devices/route.tsx'
import { routes as homeRoutes } from './home/route.tsx'
import { routes as manageRoutes } from './manage/route.tsx'

export const route = createRoute({
  getParentRoute: () => parentRoute,
  path: '/account/u/$accountId',
  component: lazyRouteComponent(() => import('./page.tsx')),
})

export const routes = [
  ...homeRoutes,
  ...devicesRoutes,
  ...manageRoutes,
  ...appsRoutes,
  ...aboutRoutes,
] as const

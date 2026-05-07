import { msg } from '@lingui/core/macro'
import { PaintBucketIcon } from '@phosphor-icons/react'
import { createRouter } from '@tanstack/react-router'
import { Palette } from '#/components/utils/palette.tsx'
import { buildRoutes as buildAccountRoutes } from './account/(authenticated)/route.tsx'
import { Route as ResetPasswordRoute } from './account/(unauthenticated)/reset-password/route.tsx'
import { RootRoute } from './route.tsx'

const authenticatedRoutes = buildAccountRoutes('/account', {
  // Custom extra pages. The purpose of these is to (eventually!) allow adding
  // custom pages (or changing existing pages) to the account manager, for
  // specific deployments, without having to fork the entire package. The page
  // below serves as an example of how this would work, and provides a "hidden"
  // page can be used by self-hosters of the "official" PDS distribution for
  // branding customization.
  '/branding': {
    icon: PaintBucketIcon,
    hidden: true,
    position: 40,
    title: msg`Branding`,
    component: Palette,
  },
})

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

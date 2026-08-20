import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { QueryClient } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ErrorView } from '#/components/error-view.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { SessionStore } from '#/contexts/session.tsx'
import type { Api } from '#/lib/api.ts'

/**
 * Everything a route's `beforeLoad` or `loader` needs, none of which it can
 * reach through React. Supplied at `<RouterProvider context={…}/>`.
 */
export type RouterContext = {
  auth: SessionStore
  api: Api
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ErrorView,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      {/* @NOTE `import.meta.env.DEV` is statically false in a production
      build, so the devtools are dropped from the bundle rather than shipped.
      bottom-right: the default corner sits on top of the account shell's
      account menu and swallows clicks meant for it. */}
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </>
  )
}

function NotFoundComponent() {
  const { t } = useLingui()
  return (
    <ErrorView title={msg`Page not found`}>
      <Button aria-label={t`Back`} render={<Link to="/account" />}>
        <Trans>Back</Trans>
      </Button>
    </ErrorView>
  )
}

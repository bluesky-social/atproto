import { ErrorView } from '#/components/error-view'
import { Button } from '#/components/ui/button.tsx'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { routes as accountRoutes } from './account/route.tsx'

export const route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  errorComponent: ErrorView,
  notFoundComponent: () => {
    const { t } = useLingui()
    return (
      <ErrorView title={msg`Page not found`}>
        <Button aria-label={t`Back`} render={<Link to="/account" />}>
          <Trans>Back</Trans>
        </Button>
      </ErrorView>
    )
  },
})

export const routes = [...accountRoutes]

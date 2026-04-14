import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ErrorView } from '#/components/error-view'

export const RootRoute = createRootRoute({
  component: () => <Outlet />,
  errorComponent: ErrorView,
})

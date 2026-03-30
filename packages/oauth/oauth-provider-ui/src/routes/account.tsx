import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ErrorCard } from '#/components/utils/error-card.tsx'

export const RootRoute = createRootRoute({
  component: () => <Outlet />,
  errorComponent: ErrorCard,
})

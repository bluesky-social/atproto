import React from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { useHydrationData } from '#/data/useHydrationData'
import { ErrorScreen, RouterErrorComponent } from '#/components/ErrorScreen'

export const Route = createRootRoute({
  component: Root,
  errorComponent: RouterErrorComponent,
})

function Root() {
  const { errorData } = useHydrationData()

  return errorData ? (
    <>
      <ErrorScreen
        title={errorData.error}
        description={errorData.error_description}
      />
    </>
  ) : (
    <>
      <Outlet />
      {/* <TanStackRouterDevtools /> */}
    </>
  )
}

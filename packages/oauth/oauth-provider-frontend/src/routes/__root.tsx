import React from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { useHydrationData } from '#/data/useHydrationData'
import { ErrorScreen, RouterErrorComponent } from '#/components/ErrorScreen'
import { Footer } from '#/components/Footer'

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
      <main className="px-4 md:px-6 pt-16">
        <div
          className="layout__center mx-auto w-full"
          style={{ maxWidth: 600 }}
        >
          <Outlet />
        </div>
      </main>
      <Footer />
      {/* <TanStackRouterDevtools /> */}
    </>
  )
}

import React from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Nav } from '#/components/Nav'
import { Footer } from '#/components/Footer'
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
      <Nav />

      <main className="bg-contrast-25 min-h-screen px-4 md:px-6 pt-16">
        <div
          className="mx-auto w-full"
          style={{ maxWidth: 600, minHeight: '100vh' }}
        >
          <Outlet />
        </div>
      </main>

      <Footer />

      {/* <TanStackRouterDevtools /> */}
    </>
  )
}

import React from 'react'
import { createFileRoute, Outlet, Navigate } from '@tanstack/react-router'

import { Nav } from '#/components/Nav'
import { Footer } from '#/components/Footer'
import { useCurrentAccount } from '#/state/account'

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  const { currentAccount } = useCurrentAccount()

  return !currentAccount ? (
    <Navigate to="/sign-in" />
  ) : (
    <>
      <Nav />

      <main className="bg-contrast-0 dark:bg-contrast-25 min-h-screen px-4 md:px-6 pt-16">
        <div
          className="mx-auto w-full"
          style={{ maxWidth: 600, minHeight: '100vh' }}
        >
          <Outlet />
        </div>
      </main>

      <Footer />
    </>
  )
}

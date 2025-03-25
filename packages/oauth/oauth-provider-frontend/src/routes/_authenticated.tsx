import React from 'react'
import { createFileRoute, Outlet, Navigate } from '@tanstack/react-router'

import { Nav } from '#/components/Nav'
import { useHasAccounts } from '#/data/useHasAccounts'
import * as Layout from '#/components/Layout'

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  const hasAccounts = useHasAccounts()

  return !hasAccounts ? (
    <Navigate to="/sign-in" />
  ) : (
    <>
      <Nav />
      <Layout.Center>
        <Outlet />
      </Layout.Center>
    </>
  )
}

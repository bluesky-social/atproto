import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import * as Layout from '#/components/Layout'
import { Nav } from '#/components/Nav'
import { useHasAccounts } from '#/data/useHasAccounts'

export const Route = createFileRoute('/_appLayout')({
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

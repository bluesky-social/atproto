import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import * as Layout from '#/components/Layout'
import { Nav } from '#/components/Nav'
import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { Route as AccountRoute } from '#/routes/account/_appLayout/$sub'

export const Route = createFileRoute('/account/_appLayout')({
  component: RouteComponent,
})

function RouteComponent() {
  const { sub } = AccountRoute.useParams()
  const { data: sessions } = useDeviceSessionsQuery()
  const activeSession = sessions.find((session) => session.account.sub === sub)
  const nextSession = sessions.find((session) => session.account.sub !== sub)

  return activeSession ? (
    <>
      <Nav />
      <Layout.Center>
        <Outlet />
      </Layout.Center>
    </>
  ) : nextSession ? (
    // or <Navigate to="/account/$sub" params={{ sub: nextSession.account.sub }} />
    <Navigate to="/account" />
  ) : (
    <Navigate to="/account/sign-in" />
  )
}

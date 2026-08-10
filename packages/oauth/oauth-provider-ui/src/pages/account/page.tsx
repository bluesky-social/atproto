import { Navigate, useNavigate } from '@tanstack/react-router'
import { AuthenticateWelcomeView } from '#/components/authenticate-welcome-view.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

export default function Page() {
  const { session, sessions, canSignUp, canSwitchAccounts, leave } =
    useSessionContext()
  const navigate = useNavigate()

  if (session) {
    const { account } = session
    return (
      <Navigate
        to="/account/u/$accountId"
        params={{ accountId: account.handle ?? account.did }}
        replace
      />
    )
  }

  if (sessions.length > 0 || !canSwitchAccounts) {
    return <Navigate to="/account/sign-in" replace />
  }

  return (
    <AuthenticateWelcomeView
      onSignIn={() => navigate({ to: '/account/sign-in' })}
      onSignUp={
        canSignUp ? () => navigate({ to: '/account/sign-up' }) : undefined
      }
      onCancel={leave}
    />
  )
}

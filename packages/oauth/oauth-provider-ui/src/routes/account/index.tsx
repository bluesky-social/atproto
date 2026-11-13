import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AuthenticateWelcomeView } from '#/components/authenticate-welcome-view.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

/**
 * The account manager's entry point. It decides which route the device's
 * sessions call for, and only renders anything of its own — the welcome
 * screen — when there is a genuine choice to offer.
 */
export const Route = createFileRoute('/account/')({
  beforeLoad: ({ context: { auth } }) => {
    const { session, sessions, canSignUp, canSwitchAccounts } = auth

    if (session && !session.loginRequired) {
      throw redirect({
        to: '/account/u/$accountId',
        params: { accountId: session.account.handle ?? session.account.did },
        replace: true,
      })
    }

    // The welcome screen only has something to offer when signing up is an
    // option and there is no account to pick from.
    if (sessions.length > 0 || !canSwitchAccounts || !canSignUp) {
      throw redirect({ to: '/account/sign-in', replace: true })
    }
  },
  component: AccountIndexPage,
})

function AccountIndexPage() {
  const { leave } = useSessionContext()
  const navigate = useNavigate()

  return (
    <AuthenticateWelcomeView
      onSignIn={() => navigate({ to: '/account/sign-in' })}
      onSignUp={() => navigate({ to: '/account/sign-up' })}
      onCancel={leave}
    />
  )
}

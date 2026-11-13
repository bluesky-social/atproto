import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { SignInView } from '#/components/sign-in-view.tsx'
import { type Session, useSessionContext } from '#/contexts/session.tsx'

export const Route = createFileRoute('/account/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const { sessions, api, canSignUp, disableRemember, forcedIdentifier, leave } =
    useSessionContext()
  const navigate = useNavigate()

  // The account awaiting password confirmation — a `loginRequired` session
  // picked from the list. `null` shows the picker.
  const [pending, setPending] = useState<Session | null>(null)

  const goToSignUp = canSignUp
    ? () => navigate({ to: '/account/sign-up' })
    : undefined

  const goToAccount = useCallback(
    (account: Pick<Account, 'did' | 'handle'>) => {
      navigate({
        to: '/account/u/$accountId',
        params: { accountId: account.handle ?? account.did },
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <SignInView
      disableRemember={disableRemember}
      forcedIdentifier={forcedIdentifier}
      sessions={sessions}
      session={pending}
      setSession={(next) => {
        // A remembered session goes straight in; anything else confirms its
        // password first.
        if (next?.loginRequired) setPending(next)
        else if (next) goToAccount(next.account)
        else setPending(null)
      }}
      onSignIn={async (data) => {
        const { account } = await api.signIn(data)
        goToAccount(account)
      }}
      onSignUp={goToSignUp}
      onForgotPassword={(email) =>
        navigate({ to: '/account/reset-password', search: { email } })
      }
      // @NOTE Only the popup/webview embedding has somewhere to go back to:
      // this is the account manager's entry point. While confirming a password,
      // the view supplies its own "back" to the picker.
      onBack={pending ? undefined : leave}
    />
  )
}

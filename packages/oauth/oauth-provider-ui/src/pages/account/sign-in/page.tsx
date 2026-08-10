import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { SignInView } from '#/components/sign-in-view.tsx'
import { type Session, useSessionContext } from '#/contexts/session.tsx'

export default function Page() {
  const { sessions, api, canSignUp, forcedIdentifier, leave } =
    useSessionContext()
  const navigate = useNavigate()

  // Account pending password confirmation (a `loginRequired` session picked
  // from the list, or an account added via the form).
  const [pending, setPending] = useState<Session | undefined>(undefined)
  // The create-vs-sign-in choice, only relevant with zero sessions.

  const goToSignUp = useMemo(() => {
    if (canSignUp) return () => navigate({ to: '/account/sign-up' })
    return undefined
  }, [navigate])

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
      forcedIdentifier={forcedIdentifier}
      sessions={sessions}
      session={pending ?? null}
      setSession={(next) => {
        if (!next) {
          setPending(undefined)
          return
        }
        const full = sessions.find(
          (s) =>
            s.account.handle === next.account.handle ||
            s.account.did === next.account.did,
        )
        // A remembered session goes straight in; otherwise confirm password.
        if (full && !full.loginRequired) goToAccount(full.account)
        else setPending(full)
      }}
      onSignIn={async (data) => {
        const output = await api.signIn(data)
        goToAccount(output.account)
      }}
      onSignUp={goToSignUp}
      onForgotPassword={(email) =>
        navigate({
          to: '/account/reset-password',
          search: (email ? { email } : {}) as never,
        })
      }
      onBack={
        pending
          ? undefined
          : (leave ?? goToSignUp ?? (() => navigate({ to: '/account' })))
      }
    />
  )
}

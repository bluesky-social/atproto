import { useCallback, useEffect, useMemo, useState } from 'react'

import { AccountPicker } from '../components/account-picker'
import { PageLayout } from '../components/page-layout'
import { SignInForm, SignInFormOutput } from '../components/sign-in-form'
import { Session } from '../types'

export type SignInViewProps = {
  sessions: readonly Session[]
  setSession: (sub: string | null) => void
  loginHint?: string

  onSignIn: (credentials: SignInFormOutput) => void | PromiseLike<void>
  onBack?: () => void
}

export function SignInView({
  loginHint,
  sessions,
  setSession,

  onSignIn,
  onBack,
}: SignInViewProps) {
  const session = useMemo(() => sessions.find((s) => s.selected), [sessions])
  const clearSession = useCallback(() => setSession(null), [setSession])
  const accounts = useMemo(() => sessions.map((s) => s.account), [sessions])
  const [showSignInForm, setShowSignInForm] = useState(sessions.length === 0)

  useEffect(() => {
    // Make sure the "back" action shows the account picker instead of the
    // sign-in form (since the account was added to the list of current
    // sessions).
    if (session) setShowSignInForm(false)
  }, [session])

  if (session) {
    // All set (parent view will handle the redirect)
    if (!session.loginRequired) return null

    return (
      <PageLayout title="Sign in" subtitle="Confirm your password to continue">
        <SignInForm
          className="max-w-lg w-full"
          remember={true}
          username={session.account.preferred_username}
          usernameReadonly={true}
          onSubmit={onSignIn}
          onCancel={clearSession}
          cancelLabel="Back" // to account picker
        />
      </PageLayout>
    )
  }

  if (loginHint) {
    return (
      <PageLayout title="Sign in" subtitle="Enter your password">
        <SignInForm
          className="max-w-lg w-full"
          username={loginHint}
          usernameReadonly={true}
          onSubmit={onSignIn}
          onCancel={onBack}
          cancelLabel="Back"
        />
      </PageLayout>
    )
  }

  if (sessions.length === 0) {
    return (
      <PageLayout title="Sign in" subtitle="Enter your username and password">
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={onSignIn}
          onCancel={onBack}
          cancelLabel="Back"
        />
      </PageLayout>
    )
  }

  if (showSignInForm) {
    return (
      <PageLayout title="Sign in" subtitle="Enter your username and password">
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={onSignIn}
          onCancel={() => setShowSignInForm(false)}
          cancelLabel="Back" // to account picker
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Sign in as..." subtitle="Select an account to continue.">
      <AccountPicker
        className="max-w-lg w-full"
        accounts={accounts}
        onAccount={(a) => setSession(a.sub)}
        onOther={() => setShowSignInForm(true)}
        onBack={onBack}
        backLabel="Back" // to previous view
      />
    </PageLayout>
  )
}

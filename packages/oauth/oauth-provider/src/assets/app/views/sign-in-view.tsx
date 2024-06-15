import { useCallback, useEffect, useMemo, useState } from 'react'

import { Session } from '../backend-data'
import { AccountPicker } from '../components/account-picker'
import { LayoutTitlePage } from '../components/layout-title-page'
import { SignInForm, SignInFormOutput } from '../components/sign-in-form'

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
      <LayoutTitlePage
        title="Sign in"
        subtitle="Confirm your password to continue"
      >
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={onSignIn}
          onCancel={clearSession}
          cancelAria="Back" // to account picker
          usernameDefault={session.account.preferred_username}
          usernameReadonly={true}
          rememberDefault={true}
        />
      </LayoutTitlePage>
    )
  }

  if (loginHint) {
    return (
      <LayoutTitlePage title="Sign in" subtitle="Enter your password">
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={onSignIn}
          onCancel={onBack}
          cancelAria="Back"
          usernameDefault={loginHint}
          usernameReadonly={true}
        />
      </LayoutTitlePage>
    )
  }

  if (sessions.length === 0) {
    return (
      <LayoutTitlePage
        title="Sign in"
        subtitle="Enter your username and password"
      >
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={onSignIn}
          onCancel={onBack}
          cancelAria="Back"
        />
      </LayoutTitlePage>
    )
  }

  if (showSignInForm) {
    return (
      <LayoutTitlePage
        title="Sign in"
        subtitle="Enter your username and password"
      >
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={onSignIn}
          onCancel={() => setShowSignInForm(false)}
          cancelAria="Back" // to account picker
        />
      </LayoutTitlePage>
    )
  }

  return (
    <LayoutTitlePage
      title="Sign in as..."
      subtitle="Select an account to continue."
    >
      <AccountPicker
        className="max-w-lg w-full"
        accounts={accounts}
        onAccount={(a) => setSession(a.sub)}
        onOther={() => setShowSignInForm(true)}
        onBack={onBack}
        backAria="Back" // to previous view
      />
    </LayoutTitlePage>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Session } from '../../../backend-data'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page'
import { Override } from '../../../lib/util'
import { SignInForm, SignInFormOutput } from './sign-in-form'
import { SignInPicker } from './sign-in-picker'

export type SignInViewProps = Override<
  Omit<LayoutTitlePageProps, 'title' | 'subtitle'>,
  {
    sessions: readonly Session[]
    selectSub: (sub: string | null) => void
    loginHint?: string

    onSignIn: (
      credentials: SignInFormOutput,
      signal: AbortSignal,
    ) => void | PromiseLike<void>
    onForgotPassword?: (emailHint?: string) => void
    onBack?: () => void
  }
>

export function SignInView({
  loginHint,
  sessions,
  selectSub,

  onSignIn,
  onForgotPassword,
  onBack,

  // LayoutTitlePage
  ...props
}: SignInViewProps) {
  const session = useMemo(() => sessions.find((s) => s.selected), [sessions])
  const clearSession = useCallback(() => selectSub(null), [selectSub])
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
        {...props}
        title="Sign in"
        subtitle="Confirm your password to continue"
      >
        <SignInForm
          onSubmit={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={clearSession}
          usernameDefault={
            session.account.preferred_username || session.account.sub
          }
          usernameReadonly={true}
          rememberDefault={true}
        />
      </LayoutTitlePage>
    )
  }

  if (loginHint) {
    return (
      <LayoutTitlePage
        {...props}
        title="Sign in"
        subtitle="Enter your password"
      >
        <SignInForm
          onSubmit={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={onBack}
          usernameDefault={loginHint}
          usernameReadonly={true}
        />
      </LayoutTitlePage>
    )
  }

  if (sessions.length === 0) {
    return (
      <LayoutTitlePage
        {...props}
        title="Sign in"
        subtitle="Enter your username and password"
      >
        <SignInForm
          onSubmit={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={onBack}
        />
      </LayoutTitlePage>
    )
  }

  if (showSignInForm) {
    return (
      <LayoutTitlePage
        {...props}
        title="Sign in"
        subtitle="Enter your username and password"
      >
        <SignInForm
          onSubmit={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={() => setShowSignInForm(false)}
        />
      </LayoutTitlePage>
    )
  }

  return (
    <LayoutTitlePage
      {...props}
      title="Sign in"
      subtitle="Select from an existing account"
    >
      <SignInPicker
        accounts={accounts}
        onAccount={(a) => selectSub(a.sub)}
        onOther={() => setShowSignInForm(true)}
        onBack={onBack}
      />
    </LayoutTitlePage>
  )
}

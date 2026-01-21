import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page.tsx'
import { Override } from '../../../lib/util.ts'
import { SignInForm, SignInFormOutput } from './sign-in-form.tsx'
import { SignInPicker } from './sign-in-picker.tsx'

export type SignInViewProps = Override<
  LayoutTitlePageProps,
  {
    sessions: readonly Session[]
    selectSub: (sub: string | null) => void
    loginHint?: string

    onSignIn: (
      credentials: SignInFormOutput,
      signal: AbortSignal,
    ) => void | PromiseLike<void>
    onSignUp?: () => void
    onForgotPassword?: (emailHint?: string) => void
    onBack?: () => void
    backLabel?: ReactNode
  }
>

export function SignInView({
  loginHint,
  sessions,
  selectSub,

  onSignIn,
  onSignUp,
  onForgotPassword,
  onBack,
  backLabel,

  // LayoutTitlePage
  title,
  subtitle,
  ...props
}: SignInViewProps) {
  const { t } = useLingui()
  const session = useMemo(() => sessions.find((s) => s.selected), [sessions])
  const clearSession = useCallback(() => selectSub(null), [selectSub])
  const accounts = useMemo(() => sessions.map((s) => s.account), [sessions])
  const [showSignInForm, setShowSignInForm] = useState(sessions.length === 0)

  title ??= t({ message: 'Sign in', context: 'noun' })

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
        title={title}
        subtitle={subtitle ?? <Trans>Confirm your password to continue</Trans>}
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
        title={title}
        subtitle={subtitle ?? <Trans>Enter your password</Trans>}
      >
        <SignInForm
          onSubmit={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={onBack}
          backLabel={backLabel}
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
        title={title}
        subtitle={subtitle ?? <Trans>Enter your username and password</Trans>}
      >
        <SignInForm
          onSubmit={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={onBack}
          backLabel={backLabel}
        />
      </LayoutTitlePage>
    )
  }

  if (showSignInForm) {
    return (
      <LayoutTitlePage
        {...props}
        title={title}
        subtitle={subtitle ?? <Trans>Enter your username and password</Trans>}
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
      title={title}
      subtitle={subtitle ?? <Trans>Select from an existing account</Trans>}
    >
      <SignInPicker
        accounts={accounts}
        onAccount={(a) => selectSub(a.sub)}
        onOther={() => setShowSignInForm(true)}
        onBack={onBack}
        backLabel={backLabel}
        onSignUp={onSignUp}
      />
    </LayoutTitlePage>
  )
}

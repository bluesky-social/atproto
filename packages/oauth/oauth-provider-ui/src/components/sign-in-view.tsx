import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { AuthShell } from './layouts/auth-shell.tsx'
import { type SignInData, SignInForm } from './sign-in-form.tsx'
import { SignInPicker } from './sign-in-picker.tsx'

export type SignInViewProps = {
  disableRemember?: boolean
  sessions: readonly Session[]
  session: Session | null
  setSession: (session: Session | null) => void
  forcedIdentifier?: string

  onSignIn: (credentials: SignInData) => void | PromiseLike<void>
  onSignUp?: () => void
  onForgotPassword?: (emailHint?: string) => void
  onBack?: () => void
  backLabel?: ReactNode
}

export function SignInView({
  disableRemember,
  forcedIdentifier,
  sessions,
  session,
  setSession,

  onSignIn,
  onSignUp,
  onForgotPassword,
  onBack,
  backLabel,
}: SignInViewProps) {
  const clearSession = useCallback(() => setSession(null), [setSession])
  const { availableUserDomains = [] } = useCustomizationData()

  const [showSignInForm, setShowSignInForm] = useState(sessions.length === 0)

  const title = msg({ message: 'Sign in', context: 'AuthenticationPage' })

  useEffect(() => {
    // Make sure the "back" action shows the account picker instead of the
    // sign-in form (since the account was added to the list of current
    // sessions).
    if (session) setShowSignInForm(false)
  }, [session])

  if (session) {
    return (
      <AuthShell
        title={title}
        subtitle={<Trans>Confirm your password to continue</Trans>}
      >
        <SignInForm
          domains={availableUserDomains}
          disableRemember={disableRemember}
          onSignIn={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={clearSession}
          usernameDefault={session.account.handle || session.account.did}
          usernameReadonly={true}
          rememberDefault={true}
        />
      </AuthShell>
    )
  }

  if (forcedIdentifier) {
    return (
      <AuthShell title={title} subtitle={<Trans>Enter your password</Trans>}>
        <SignInForm
          domains={availableUserDomains}
          disableRemember={disableRemember}
          onSignIn={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={onBack}
          backLabel={backLabel}
          usernameDefault={forcedIdentifier}
          usernameReadonly={true}
        />
      </AuthShell>
    )
  }

  if (sessions.length === 0) {
    return (
      <AuthShell
        title={title}
        subtitle={<Trans>Enter your username and password</Trans>}
      >
        <SignInForm
          domains={availableUserDomains}
          disableRemember={disableRemember}
          onSignIn={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={onBack}
          backLabel={backLabel}
        />
      </AuthShell>
    )
  }

  if (showSignInForm) {
    return (
      <AuthShell
        title={title}
        subtitle={<Trans>Enter your username and password</Trans>}
      >
        <SignInForm
          domains={availableUserDomains}
          disableRemember={disableRemember}
          onSignIn={onSignIn}
          onForgotPassword={onForgotPassword}
          onBack={() => setShowSignInForm(false)}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={title}
      subtitle={<Trans>Select from an existing account</Trans>}
    >
      <SignInPicker
        sessions={sessions}
        onSession={setSession}
        onOther={() => setShowSignInForm(true)}
        onBack={onBack}
        backLabel={backLabel}
        onSignUp={onSignUp}
      />
    </AuthShell>
  )
}

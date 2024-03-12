import { useCallback, useEffect, useMemo, useState } from 'react'

import { AcceptForm } from '../components/accept-form'
import { AccountPicker } from '../components/account-picker'
import { ClientName } from '../components/client-name'
import { PageLayout } from '../components/page-layout'
import { SignInForm, SignInFormOutput } from '../components/sign-in-form'
import { Account, ClientMetadata, Session } from '../types'

export type SignInViewProps = {
  clientId: string
  clientMetadata: ClientMetadata
  sessions: readonly Session[]
  setSession: (sub: string | null) => void
  loginHint?: string

  onAccept: (account: Account) => void
  onReject: () => void
  onSignIn: (credentials: SignInFormOutput) => string | PromiseLike<string>
  onBack?: () => void
}

export function SignInView({
  clientId,
  clientMetadata,
  loginHint,
  sessions,
  setSession,

  onAccept,
  onReject,
  onSignIn,
  onBack = onReject,
}: SignInViewProps) {
  const session = useMemo(() => sessions.find((s) => s.selected), [sessions])
  const clearSession = useCallback(() => setSession(null), [setSession])
  const accounts = useMemo(() => sessions.map((s) => s.account), [sessions])
  const [showSignInForm, setShowSignInForm] = useState(sessions.length === 0)

  useEffect(() => {
    // Automatically accept
    if (session && !session.loginRequired && !session.consentRequired) {
      onAccept(session.account)
    }

    // Make sure the "back" action shows the account picker instead of the
    // sign-in form (since the account was added to the list of current
    // sessions).
    if (session) {
      setShowSignInForm(false)
    }
  }, [session])

  const doAccept = useCallback(
    () => (session ? onAccept(session.account) : undefined),
    [onAccept, session],
  )

  const doSignIn = useCallback(
    async (credentials: SignInFormOutput) => {
      await onSignIn(credentials)
    },
    [onSignIn],
  )

  if (session && !session.loginRequired) {
    const { account } = session
    return (
      <PageLayout
        title="Authorize"
        subtitle={
          <>
            Grant access to your{' '}
            <b>{account.preferred_username || account.email || account.sub}</b>{' '}
            account.
          </>
        }
      >
        <AcceptForm
          className="max-w-lg w-full"
          clientId={clientId}
          clientMetadata={clientMetadata}
          account={account}
          onBack={clearSession}
          onAccept={doAccept}
          onReject={onReject}
        />
      </PageLayout>
    )
  }

  if (session && session.loginRequired) {
    return (
      <PageLayout title="Sign in" subtitle="Confirm your password to continue">
        <SignInForm
          className="max-w-lg w-full"
          remember={true}
          username={session.account.preferred_username}
          usernameReadonly={true}
          onSubmit={doSignIn}
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
          onSubmit={doSignIn}
          onCancel={onReject}
          cancelLabel="Back" // to client app
        />
      </PageLayout>
    )
  }

  if (sessions.length === 0) {
    return (
      <PageLayout title="Sign in" subtitle="Enter your username and password">
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={doSignIn}
          onCancel={onBack}
          cancelLabel="Back" // to previous view
        />
      </PageLayout>
    )
  }

  if (showSignInForm) {
    return (
      <PageLayout title="Sign in" subtitle="Enter your username and password">
        <SignInForm
          className="max-w-lg w-full"
          onSubmit={doSignIn}
          onCancel={() => setShowSignInForm(false)}
          cancelLabel="Back" // to account picker
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Sign in as..."
      subtitle={
        <>
          Select an account to access to{' '}
          <ClientName
            clientMetadata={clientMetadata}
            clientId={clientId}
            as="b"
          />
          .
        </>
      }
    >
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

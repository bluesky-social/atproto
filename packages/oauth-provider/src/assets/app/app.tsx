import { useMemo, useState } from 'react'

import type { AuthorizeData, BrandingData } from './backend-data'
import { cookies } from './cookies'
import { Account, Session } from './types'

import { AcceptForm } from './components/accept-form'
import { AccountPicker } from './components/account-picker'
import { PageLayout } from './components/page-layout'
import { SignInForm, SignInFormOutput } from './components/sign-in-form'
import { Api, SignInResponse } from './lib/api'

type AppProps = {
  authorizeData: AuthorizeData
  brandingData?: BrandingData
}

// TODO: show brandingData when "flow" is null

export function App({ authorizeData }: AppProps) {
  const {
    requestUri,
    clientId,
    clientMetadata,
    csrfCookie,
    loginHint,
    sessions: initialSessions,
  } = authorizeData

  const csrfToken = useMemo(() => cookies[csrfCookie], [csrfCookie])
  const [isDone, setIsDone] = useState(false)
  // const [flow, setFlow] = useState<null | 'sign-in' | 'sign-up'>(
  //   loginHint != null ? 'sign-in' : null,
  // )
  const [sessions, setSessions] = useState(initialSessions)
  const accounts = useMemo(() => sessions.map((s) => s.account), [sessions])
  const [showSignInForm, setShowSignInForm] = useState(sessions.length === 0)
  const [sub, setSub] = useState(
    sessions.find((s) => s.initiallySelected)?.account.sub || null,
  )
  const clearSub = () => setSub(null)

  const session = useMemo(() => {
    return sub ? sessions.find((s) => s.account.sub == sub) : undefined
  }, [sub, sessions])

  const api = useMemo(
    () => new Api(requestUri, clientId, csrfToken),
    [requestUri, clientId, csrfToken],
  )

  const handleSignIn = async (credentials: SignInFormOutput) => {
    const { account, info } = await api.signIn(credentials)

    const newSessions = updateSessions(sessions, { account, info }, clientId)

    setSessions(newSessions)
    setSub(account.sub)
  }

  const handleAccept = async (account: Account) => {
    setIsDone(true)
    api.accept(account)
  }

  const handleReject = () => {
    setIsDone(true)
    api.reject()
  }

  if (isDone) {
    return (
      <PageLayout title="Login complete">You are being redirected</PageLayout>
    )
  }

  // if (!flow) {
  //   return (
  //     <PageLayout title="Sign in as...">
  //       <button onClick={() => setFlow('sign-in')}>Sign in</button>
  //       <button onClick={() => setFlow('sign-up')}>Sign up</button>
  //       <button onClick={handleReject}>Abort</button>
  //     </PageLayout>
  //   )
  // }

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
          onBack={clearSub}
          onAccept={() => handleAccept(account)}
          onReject={handleReject}
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
          onSubmit={handleSignIn}
          onCancel={clearSub}
          cancelLabel={'Back' /* to account picker */}
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
          onSubmit={handleSignIn}
          onCancel={handleReject}
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
          onSubmit={handleSignIn}
          onCancel={handleReject}
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
          onSubmit={handleSignIn}
          onCancel={() => setShowSignInForm(false)}
          cancelLabel={'Back' /* to account picker */}
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
          <b>
            {clientMetadata.client_name ||
              clientMetadata.client_uri ||
              clientId}
          </b>
          .
        </>
      }
    >
      <AccountPicker
        className="max-w-lg w-full"
        accounts={accounts}
        onAccount={(a) => setSub(a.sub)}
        onOther={() => setShowSignInForm(true)}
        onBack={handleReject}
        backLabel="Back"
      />
    </PageLayout>
  )
}

function updateSessions(
  sessions: readonly Session[],
  { account, info }: SignInResponse,
  clientId: string,
): Session[] {
  const consentRequired = !info.authorizedClients.includes(clientId)

  const sessionIdx = sessions.findIndex((s) => s.account.sub === account.sub)
  if (sessionIdx === -1) {
    const newSession: Session = {
      initiallySelected: false,
      account,
      loginRequired: false,
      consentRequired,
    }
    return [...sessions, newSession]
  } else {
    const curSession = sessions[sessionIdx]
    const newSession: Session = {
      ...curSession,
      initiallySelected: false,
      account,
      consentRequired,
      loginRequired: false,
    }
    return [
      ...sessions.slice(0, sessionIdx),
      newSession,
      ...sessions.slice(sessionIdx + 1),
    ]
  }
}

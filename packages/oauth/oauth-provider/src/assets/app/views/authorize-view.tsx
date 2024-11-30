import { useEffect, useState } from 'react'

import type { AuthorizeData, CustomizationData } from '../backend-data'
import { LayoutTitlePage } from '../components/layout-title-page'
import { useApi } from '../hooks/use-api'
import { useBoundDispatch } from '../hooks/use-bound-dispatch'
import { AcceptView } from './accept-view'
import { SignInView } from './sign-in-view'
import { SignUpView } from './sign-up-view'
import { WelcomeView } from './welcome-view'

export type AuthorizeViewProps = {
  authorizeData: AuthorizeData
  customizationData?: CustomizationData
}

export function AuthorizeView({
  authorizeData,
  customizationData,
}: AuthorizeViewProps) {
  const forceSignIn = authorizeData?.loginHint != null

  const [view, setView] = useState<
    'welcome' | 'sign-in' | 'sign-up' | 'accept' | 'done'
  >(forceSignIn ? 'sign-in' : 'welcome')

  const showDone = useBoundDispatch(setView, 'done')
  const showSignIn = useBoundDispatch(setView, 'sign-in')
  // const showSignUp = useBoundDispatch(setView, 'sign-up')
  const showAccept = useBoundDispatch(setView, 'accept')
  const showWelcome = useBoundDispatch(setView, 'welcome')

  const { sessions, setSession, doAccept, doReject, doSignIn, doSignUp } =
    useApi(authorizeData, { onRedirected: showDone })

  const session = sessions.find((s) => s.selected && !s.loginRequired)
  useEffect(() => {
    if (session) {
      if (session.consentRequired) showAccept()
      else doAccept(session.account)
    }
  }, [session, doAccept, showAccept])

  if (view === 'welcome') {
    return (
      <WelcomeView
        name={customizationData?.name}
        logo={customizationData?.logo}
        links={customizationData?.links}
        onSignIn={showSignIn}
        // onSignUp={showSignUp}
        onCancel={doReject}
      />
    )
  }

  if (view === 'sign-up') {
    return (
      <SignUpView
        links={customizationData?.links}
        onSignUp={doSignUp}
        onBack={showWelcome}
      />
    )
  }

  if (view === 'sign-in') {
    return (
      <SignInView
        loginHint={authorizeData.loginHint}
        sessions={sessions}
        setSession={setSession}
        onSignIn={doSignIn}
        onBack={forceSignIn ? doReject : showWelcome}
      />
    )
  }

  if (view === 'accept' && session) {
    return (
      <AcceptView
        clientId={authorizeData.clientId}
        clientMetadata={authorizeData.clientMetadata}
        clientTrusted={authorizeData.clientTrusted}
        account={session.account}
        scopeDetails={authorizeData.scopeDetails}
        onAccept={() => doAccept(session.account)}
        onReject={doReject}
        onBack={
          forceSignIn
            ? undefined
            : () => {
                setSession(null)
                setView(sessions.length ? 'sign-in' : 'welcome')
              }
        }
      />
    )
  }

  return (
    <LayoutTitlePage title="Login complete">
      You are being redirected...
    </LayoutTitlePage>
  )
}

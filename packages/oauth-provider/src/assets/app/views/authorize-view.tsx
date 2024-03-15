import { useEffect, useState } from 'react'

import type { AuthorizeData, CustomizationData } from '../backend-data'
import { PageLayout } from '../components/page-layout'
import { useBoundDispatch } from '../hooks/use-bound-dispatch'
import { useApi } from '../hooks/use-api'
import { SignInView } from './sign-in-view'
import { WelcomeView } from './welcome-view'
import { AcceptView } from './accept-view'

export type AuthorizeViewProps = {
  authorizeData: AuthorizeData
  customizationData?: CustomizationData
}

export function AuthorizeView({
  authorizeData,
  customizationData,
}: AuthorizeViewProps) {
  const forceSignIn = authorizeData?.loginHint != null

  const [view, setView] = useState<'welcome' | 'sign-in' | 'accept' | 'done'>(
    forceSignIn ? 'sign-in' : 'welcome',
  )

  const showDone = useBoundDispatch(setView, 'done')
  const showSignIn = useBoundDispatch(setView, 'sign-in')
  const showAccept = useBoundDispatch(setView, 'accept')
  const showWelcome = useBoundDispatch(setView, 'welcome')

  const { sessions, setSession, doAccept, doReject, doSignIn } = useApi(
    authorizeData,
    { onRedirected: showDone },
  )

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
        onSignUp={undefined}
        onCancel={doReject}
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
        session={session}
        clientId={authorizeData.clientId}
        clientMetadata={authorizeData.clientMetadata}
        onAccept={() => doAccept(session.account)}
        onReject={doReject}
        onBack={() => setSession(null)}
      />
    )
  }

  return (
    <PageLayout title="Login complete">You are being redirected...</PageLayout>
  )
}

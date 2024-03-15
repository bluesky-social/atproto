import { useState } from 'react'

import type { AuthorizeData, CustomizationData } from '../backend-data'
import { PageLayout } from '../components/page-layout'
import { useBoundDispatch } from '../hooks/use-bound-dispatch'
import { useApi } from '../hooks/use-api'
import { SignInView } from './sign-in-view'
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

  const [view, setView] = useState<'welcome' | 'sign-in' | 'done'>(
    forceSignIn ? 'sign-in' : 'welcome',
  )

  const showDone = useBoundDispatch(setView, 'done')
  const showSignIn = useBoundDispatch(setView, 'sign-in')
  const showWelcome = useBoundDispatch(setView, 'welcome')

  const { sessions, setSession, doAccept, doReject, doSignIn } = useApi(
    authorizeData,
    { onRedirected: showDone },
  )

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
        clientId={authorizeData.clientId}
        clientMetadata={authorizeData.clientMetadata}
        loginHint={authorizeData.loginHint}
        sessions={sessions}
        setSession={setSession}
        onAccept={doAccept}
        onReject={doReject}
        onSignIn={doSignIn}
        onBack={forceSignIn ? doReject : showWelcome}
      />
    )
  }

  return (
    <PageLayout title="Login complete">You are being redirected...</PageLayout>
  )
}

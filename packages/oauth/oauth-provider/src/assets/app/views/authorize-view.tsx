import { useEffect, useState } from 'react'

import type { AuthorizeData, CustomizationData } from '../backend-data'
import { LayoutTitlePage } from '../components/layout-title-page'
import { useApi } from '../hooks/use-api'
import { useBoundDispatch } from '../hooks/use-bound-dispatch'
import { AcceptView } from './accept-view'
import { SignInView } from './sign-in-view'
import { SignUpView } from './sign-up-view'
import { WelcomeView } from './welcome-view'
import { ResetPasswordView } from './reset-password-view'

export type AuthorizeViewProps = {
  authorizeData: AuthorizeData
  customizationData?: CustomizationData
}

enum View {
  Welcome,
  SignUp,
  SignIn,
  ResetPassword,
  Accept,
  Done,
}

export function AuthorizeView({
  authorizeData,
  customizationData,
}: AuthorizeViewProps) {
  const forceSignIn = authorizeData?.loginHint != null

  const initialView = forceSignIn ? View.SignIn : View.Welcome
  const [view, setView] = useState<View>(initialView)

  const showDone = useBoundDispatch(setView, View.Done)
  const showSignIn = useBoundDispatch(setView, View.SignIn)
  const showResetPassword = useBoundDispatch(setView, View.ResetPassword)
  // const showSignUp = useBoundDispatch(setView, View.SignUp)
  const showAccept = useBoundDispatch(setView, View.Accept)
  const showWelcome = useBoundDispatch(setView, View.Welcome)

  const {
    sessions,
    setSession,
    doSignUp,
    doSignIn,
    doInitiatePasswordReset,
    doConfirmResetPassword,
    doAccept,
    doReject,
  } = useApi(authorizeData, { onRedirected: showDone })

  const session = sessions.find((s) => s.selected && !s.loginRequired)
  useEffect(() => {
    if (session) {
      if (session.consentRequired) showAccept()
      else doAccept(session.account)
    }
  }, [session, doAccept, showAccept])

  if (view === View.Welcome) {
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

  if (view === View.SignUp) {
    return (
      <SignUpView
        links={customizationData?.links}
        onSignUp={doSignUp}
        onBack={showWelcome}
      />
    )
  }

  if (view === View.ResetPassword) {
    return (
      <ResetPasswordView
        onResetPasswordInit={doInitiatePasswordReset}
        onResetPasswordConfirm={doConfirmResetPassword}
        onBack={forceSignIn ? showSignIn : showWelcome}
      />
    )
  }

  if (view === View.SignIn) {
    return (
      <SignInView
        loginHint={authorizeData.loginHint}
        sessions={sessions}
        setSession={setSession}
        onSignIn={doSignIn}
        onBack={forceSignIn ? doReject : showWelcome}
        onForgotPassword={showResetPassword}
      />
    )
  }

  if (view === View.Accept && session) {
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
                setView(sessions.length ? View.SignIn : View.Welcome)
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

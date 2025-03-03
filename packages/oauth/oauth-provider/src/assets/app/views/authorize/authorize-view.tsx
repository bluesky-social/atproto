import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import type { AuthorizeData, CustomizationData } from '../../backend-types.ts'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../components/layouts/layout-title-page.tsx'
import { useApi } from '../../hooks/use-api.ts'
import { useBoundDispatch } from '../../hooks/use-bound-dispatch.ts'
import { Override } from '../../lib/util.ts'
import { AcceptView } from './accept/accept-view.tsx'
import { ResetPasswordView } from './reset-password/reset-password-view.tsx'
import { SignInView } from './sign-in/sign-in-view.tsx'
import { SignUpView } from './sign-up/sign-up-view.tsx'
import { WelcomeView } from './welcome/welcome-view.tsx'

export type AuthorizeViewProps = Override<
  LayoutTitlePageProps,
  {
    customizationData?: CustomizationData
    authorizeData: AuthorizeData
  }
>

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

  // LayoutTitlePage
  ...props
}: AuthorizeViewProps) {
  const { t } = useLingui()

  const forceSignIn = authorizeData?.loginHint != null

  const initialView = forceSignIn ? View.SignIn : View.Welcome
  const [view, setView] = useState<View>(initialView)

  const showDone = useBoundDispatch(setView, View.Done)
  const showSignIn = useBoundDispatch(setView, View.SignIn)
  const showResetPassword = useBoundDispatch(setView, View.ResetPassword)
  const showSignUp = useBoundDispatch(setView, View.SignUp)
  const showAccept = useBoundDispatch(setView, View.Accept)
  const showWelcome = useBoundDispatch(setView, View.Welcome)

  const [resetPasswordHint, setResetPasswordHint] = useState<
    string | undefined
  >(undefined)

  const {
    sessions,
    selectSub,
    doValidateNewHandle,
    doSignUp,
    doSignIn,
    doInitiatePasswordReset,
    doConfirmResetPassword,
    doAccept,
    doReject,
  } = useApi({ ...authorizeData, onRedirected: showDone })

  // Navigate when the user signs-in (selects a new session)
  const session = sessions.find((s) => s.selected && !s.loginRequired)
  useEffect(() => {
    if (session) {
      if (session.consentRequired) showAccept()
      else doAccept(session.account)
    }
  }, [session, doAccept, showAccept])

  const canSignUp =
    Boolean(customizationData?.availableUserDomains?.length) &&
    !authorizeData.loginHint

  // Fool-proofing
  const resetNeeded =
    (view === View.SignUp && !canSignUp) || (view === View.Accept && !session)
  useEffect(() => {
    if (resetNeeded) showWelcome()
  }, [resetNeeded, showWelcome])

  if (view === View.Welcome) {
    return (
      <WelcomeView
        {...props}
        customizationData={customizationData}
        onSignIn={showSignIn}
        onSignUp={canSignUp ? showSignUp : undefined}
        onCancel={doReject}
      />
    )
  }

  if (view === View.SignUp) {
    return (
      <SignUpView
        {...props}
        customizationData={customizationData}
        onValidateNewHandle={doValidateNewHandle}
        onBack={showWelcome}
        onDone={doSignUp}
      />
    )
  }

  if (view === View.ResetPassword) {
    return (
      <ResetPasswordView
        {...props}
        emailDefault={resetPasswordHint}
        onresetPasswordRequest={doInitiatePasswordReset}
        onResetPasswordConfirm={doConfirmResetPassword}
        onBack={forceSignIn ? showSignIn : showWelcome}
      />
    )
  }

  if (view === View.SignIn) {
    return (
      <SignInView
        {...props}
        loginHint={authorizeData.loginHint}
        sessions={sessions}
        selectSub={selectSub}
        onSignIn={doSignIn}
        onBack={forceSignIn ? doReject : showWelcome}
        onForgotPassword={(email) => {
          showResetPassword()
          setResetPasswordHint(email)
        }}
      />
    )
  }

  if (view === View.Accept) {
    // TypeSafety: should never be null here
    if (!session) return null

    return (
      <AcceptView
        {...props}
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
                selectSub(null)
                setView(sessions.length ? View.SignIn : View.Welcome)
              }
        }
      />
    )
  }

  if (view === View.Done) {
    return (
      <LayoutTitlePage {...props} title={props.title ?? t`Login complete`}>
        <Trans>You are being redirected...</Trans>
      </LayoutTitlePage>
    )
  }

  // Fool-proofing
  throw new Error('Unexpected application state')
}

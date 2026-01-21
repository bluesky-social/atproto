import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import type { CustomizationData, Session } from '@atproto/oauth-provider-api'
import { OAuthPromptMode } from '@atproto/oauth-types'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../components/layouts/layout-title-page.tsx'
import { useApi } from '../../hooks/use-api.ts'
import { useBoundDispatch } from '../../hooks/use-bound-dispatch.ts'
import type { AuthorizeData } from '../../hydration-data'
import { Override } from '../../lib/util.ts'
import { ConsentView } from './consent/consent-view.tsx'
import { ResetPasswordView } from './reset-password/reset-password-view.tsx'
import { SignInView } from './sign-in/sign-in-view.tsx'
import { SignUpView } from './sign-up/sign-up-view.tsx'
import { WelcomeView } from './welcome/welcome-view.tsx'

export type AuthorizeViewProps = Override<
  LayoutTitlePageProps,
  {
    customizationData?: CustomizationData
    authorizeData: AuthorizeData
    initialSessions: readonly Session[]
  }
>

enum View {
  Welcome,
  SignUp,
  SignIn,
  ResetPassword,
  Consent,
  Done,
}

function getInitialView(
  promptMode: OAuthPromptMode | undefined,
  canSignUp: boolean,
  forceSignIn: boolean,
  hasInitialSessions: boolean,
): (typeof View)[keyof typeof View] {
  if (promptMode === 'create' && canSignUp) {
    return View.SignUp
  } else if (forceSignIn) {
    return View.SignIn
  } else if (!canSignUp || hasInitialSessions) {
    return View.SignIn
  }

  return View.Welcome
}

export function AuthorizeView({
  authorizeData,
  initialSessions,
  customizationData,

  // LayoutTitlePage
  ...props
}: AuthorizeViewProps) {
  const { t } = useLingui()

  const forceSignIn = authorizeData.loginHint != null

  const hasAvailableSessions = Boolean(initialSessions.length)
  const hasAvailableUserDomains = Boolean(
    customizationData?.availableUserDomains?.length,
  )
  const canSignUp = !forceSignIn && hasAvailableUserDomains

  const initialView = getInitialView(
    authorizeData.promptMode,
    hasAvailableUserDomains,
    forceSignIn,
    hasAvailableSessions,
  )

  const [view, setView] = useState<View>(initialView)

  const showDone = useBoundDispatch(setView, View.Done)
  const showSignIn = useBoundDispatch(setView, View.SignIn)
  const showResetPassword = useBoundDispatch(setView, View.ResetPassword)
  const showSignUp = useBoundDispatch(setView, View.SignUp)
  const showConsent = useBoundDispatch(setView, View.Consent)

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
    doConsent,
    doReject,
  } = useApi({
    sessions: initialSessions,
    onRedirected: showDone,
  })

  const homeView = !canSignUp || sessions.length ? View.SignIn : View.Welcome
  const showHome = useBoundDispatch(setView, homeView)
  const showSignUpIfAllowed = canSignUp ? showSignUp : undefined

  // Navigate when the user signs-in (selects a new session)
  const session = sessions.find((s) => s.selected && !s.loginRequired)
  useEffect(() => {
    if (session) {
      if (session.consentRequired) showConsent()
      else doConsent(session.account.sub)
    }
  }, [session, doConsent, showConsent])

  // Fool-proofing
  useEffect(() => {
    if (view === View.SignUp && !canSignUp) setView(homeView)
  }, [view, homeView, !canSignUp])
  useEffect(() => {
    if (view === View.Consent && !session) setView(homeView)
  }, [view, homeView, !session])
  useEffect(() => {
    if (view === View.Welcome && homeView !== View.Welcome) setView(homeView)
  }, [view, homeView])

  if (view === View.Welcome) {
    return (
      <WelcomeView
        {...props}
        customizationData={customizationData}
        onSignIn={showSignIn}
        onSignUp={showSignUpIfAllowed}
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
        onBack={showHome}
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
        onBack={showHome}
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
        onSignUp={showSignUpIfAllowed}
        onBack={homeView === View.SignIn ? doReject : showHome}
        backLabel={homeView === View.SignIn ? t`Cancel` : undefined}
        onForgotPassword={(email) => {
          showResetPassword()
          setResetPasswordHint(email)
        }}
      />
    )
  }

  if (view === View.Consent) {
    // TypeSafety: should never be null here
    if (!session) return null

    return (
      <ConsentView
        {...props}
        clientId={authorizeData.clientId}
        clientMetadata={authorizeData.clientMetadata}
        clientTrusted={authorizeData.clientTrusted}
        clientFirstParty={authorizeData.clientFirstParty}
        permissionSets={authorizeData.permissionSets}
        account={session.account}
        scope={authorizeData.scope}
        onConsent={(scope) => doConsent(session.account.sub, scope)}
        onReject={doReject}
        onBack={
          forceSignIn
            ? undefined
            : () => {
                selectSub(null)
                showHome()
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

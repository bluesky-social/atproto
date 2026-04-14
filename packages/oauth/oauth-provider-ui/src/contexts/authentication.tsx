import { Trans } from '@lingui/react/macro'
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { OAuthPromptMode } from '@atproto/oauth-types'
import { AuthenticateWelcomeView } from '#/components/authenticate-welcome-view.tsx'
import { ResetPasswordView } from '#/components/reset-password-view.tsx'
import { SignInView } from '#/components/sign-in-view.tsx'
import { SignUpView } from '#/components/sign-up-view.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { Session, useSessionContext } from '#/contexts/session.tsx'

enum View {
  Welcome,
  SignUp,
  SignIn,
  ResetPassword,
  Authenticated,
}

export type AuthenticationContextType = {
  session: Session
  sessions: readonly Session[]
  canSwitchAccounts: boolean
}

const AuthenticationContext = createContext<null | AuthenticationContextType>(
  null,
)

export type AuthenticationProviderProps = {
  disableRemember?: boolean
  promptMode?: OAuthPromptMode
  forcedIdentifier?: string
  onCancel?: () => void
  children: ReactNode
}

/**
 * Gates the inner content (children) behind an authentication flow. Provides
 * the authenticated session via context to its children.
 */
export function AuthenticationProvider({
  disableRemember = false,
  promptMode,
  forcedIdentifier,
  onCancel,
  children,
}: AuthenticationProviderProps): ReactNode {
  const { availableUserDomains } = useCustomizationData()
  const canSignUp = Boolean(availableUserDomains?.length)

  const [resetPasswordHint, setResetPasswordHint] = useState<
    string | undefined
  >(undefined)

  const {
    sessions: currentSessions,
    session: currentSession,
    setSession,
    doValidateNewHandle,
    doSignUp,
    doSignIn,
    doInitiatePasswordReset,
    doConfirmResetPassword,
  } = useSessionContext()

  // If there is a login hint, we constrain the session to the one matching the
  // hint (if any)
  // @TODO Move this logic into the <SessionProvider>.
  const [canSwitchAccounts, session, sessions] = useMemo<
    [
      canSwitchAccounts: boolean,
      session: Session | null,
      sessions: readonly Session[],
    ]
  >(() => {
    if (!forcedIdentifier) {
      return [true, currentSession, currentSessions]
    } else {
      const matchingSessions = currentSessions.filter(
        ({ account }) =>
          account.sub === forcedIdentifier ||
          account.preferred_username === forcedIdentifier,
      )
      return [false, matchingSessions[0] ?? null, matchingSessions]
    }
  }, [currentSession, currentSessions, forcedIdentifier])

  const homeView =
    !canSignUp || sessions.length > 0 || !canSwitchAccounts
      ? View.SignIn
      : View.Welcome

  const [view, setView] = useState<View>(() => {
    if (promptMode === 'create' && canSignUp) {
      return View.SignUp
    }

    return homeView
  })

  const showHome = () => setView(homeView)
  const showSignIn = () => setView(View.SignIn)
  const showSignUpIfAllowed = canSignUp ? () => setView(View.SignUp) : undefined

  // Fool-proofing
  useEffect(() => {
    if (view === View.SignUp && !canSignUp) setView(homeView)
  }, [view, homeView, !canSignUp])
  useEffect(() => {
    if (view === View.Authenticated) {
      if (!session) setView(homeView)
      else if (session.loginRequired) setView(View.SignIn)
    }
  }, [view, homeView, !session])
  useEffect(() => {
    if (view === View.Welcome && homeView !== View.Welcome) setView(homeView)
  }, [view, homeView])
  useEffect(() => {
    if (
      view === View.SignIn &&
      session != null &&
      session.loginRequired === false
    ) {
      setView(View.Authenticated)
    }
  }, [view, session])

  const value = useMemo<AuthenticationContextType | null>(() => {
    if (!session || session.loginRequired) return null
    return { session, sessions, canSwitchAccounts }
  }, [session, sessions, canSwitchAccounts])

  if (!value) {
    if (view === View.Welcome) {
      return (
        <AuthenticateWelcomeView
          onSignIn={showSignIn}
          onSignUp={showSignUpIfAllowed}
          onCancel={onCancel}
        />
      )
    }

    if (view === View.SignUp) {
      return (
        <SignUpView
          onValidateNewHandle={doValidateNewHandle}
          onBack={showHome}
          onDone={doSignUp}
        />
      )
    }

    if (view === View.ResetPassword) {
      return (
        <ResetPasswordView
          emailDefault={resetPasswordHint}
          onResetPasswordRequest={doInitiatePasswordReset}
          onResetPasswordConfirm={doConfirmResetPassword}
          onBack={showSignIn}
        />
      )
    }

    return (
      <SignInView
        disableRemember={disableRemember}
        forcedIdentifier={forcedIdentifier}
        sessions={sessions}
        session={session}
        setSession={setSession}
        onSignIn={doSignIn}
        onSignUp={showSignUpIfAllowed}
        onBack={homeView === View.SignIn ? onCancel : showHome}
        backLabel={homeView === View.SignIn ? <Trans>Cancel</Trans> : undefined}
        onForgotPassword={(email) => {
          setView(View.ResetPassword)
          setResetPasswordHint(email)
        }}
      />
    )
  }

  return <AuthenticationContext value={value}>{children}</AuthenticationContext>
}

export function useAuthenticationContext() {
  const context = useContext(AuthenticationContext)
  if (context) return context
  throw new Error(
    'useAuthenticationContext must be used within an AuthenticationProvider',
  )
}

export function useAuthenticatedSession() {
  return useAuthenticationContext().session
}

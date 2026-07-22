import { Trans } from '@lingui/react/macro'
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { OAuthPromptMode } from '@atproto/oauth-types'
import { AuthenticateWelcomeView } from '#/components/authenticate-welcome-view.tsx'
import { ResetPasswordView } from '#/components/reset-password-view.tsx'
import { SignInView } from '#/components/sign-in-view.tsx'
import { SignUpView } from '#/components/sign-up-view.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { type Session, useSessionContext } from '#/contexts/session.tsx'
import type { Api } from '#/lib/api'
import {
  type AuthStep,
  readLocationStep,
  syncLocationStep,
} from '#/lib/location-step.ts'

enum View {
  Welcome,
  SignUp,
  SignIn,
  ResetPassword,
  Authenticated,
}

function viewFromStep(step: AuthStep): View | undefined {
  switch (step) {
    case 'welcome':
      return View.Welcome
    case 'sign-in':
      return View.SignIn
    case 'sign-up':
      return View.SignUp
    case 'reset-password':
    case 'reset-password-confirm':
      return View.ResetPassword
    case 'consent':
      // The consent view is derived from the session state (which
      // survives refresh through cookies); nothing to restore here.
      return undefined
  }
}

function stepFromView(view: View): AuthStep {
  switch (view) {
    case View.Welcome:
      return 'welcome'
    case View.SignIn:
      return 'sign-in'
    case View.SignUp:
      return 'sign-up'
    case View.ResetPassword:
      return 'reset-password'
    case View.Authenticated:
      return 'consent'
  }
}

export type AuthenticationContextType = {
  session: Session
  sessions: readonly Session[]
  canSwitchAccounts: boolean
  api: Api
}

const AuthenticationContext = createContext<null | AuthenticationContextType>(
  null,
)
AuthenticationContext.displayName = 'AuthenticationContext'

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
    api,
    setSession,
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
          account.did === forcedIdentifier ||
          account.handle === forcedIdentifier,
      )
      // @NOTE There is only one session per did
      const matchingSession = currentSession
        ? matchingSessions.find(
            ({ account }) => account.did === currentSession.account.did,
          ) ?? null
        : null

      return [false, matchingSession, matchingSessions]
    }
  }, [currentSession, currentSessions, forcedIdentifier])

  const homeView =
    canSwitchAccounts && canSignUp && sessions.length === 0
      ? View.Welcome
      : View.SignIn

  // Step restored from the URL fragment (if any), read once at mount.
  // Allows refreshing the page without being sent back to the initial
  // view.
  const [initialStep] = useState(readLocationStep)

  const [view, setView] = useState<View>(() => {
    // A step in the URL means the user was already navigating the flow
    // before a refresh; restore it in preference to the prompt default.
    const initialView = initialStep ? viewFromStep(initialStep) : undefined
    if (initialView != null) return initialView

    if (promptMode === 'create' && canSignUp) {
      return View.SignUp
    }

    return homeView
  })

  const [resetPasswordConfirm, setResetPasswordConfirm] = useState(
    initialStep === 'reset-password-confirm',
  )

  // Reflect the current step in the URL fragment so that refreshing the
  // page restores the user to the same place. replaceState is used so
  // that view changes never create browser history entries.
  useEffect(() => {
    syncLocationStep(
      view === View.ResetPassword && resetPasswordConfirm
        ? 'reset-password-confirm'
        : stepFromView(view),
    )
  }, [view, resetPasswordConfirm])

  const showHome = () => setView(homeView)
  const showSignIn = () => setView(View.SignIn)
  const showSignUpIfAllowed = canSignUp ? () => setView(View.SignUp) : undefined

  // Fool-proofing
  useEffect(() => {
    if (view === View.Authenticated) {
      if (session && session.loginRequired) setView(View.SignIn)
      else if (!session) setView(homeView)
    } else if (view === View.Welcome) {
      if (homeView !== View.Welcome) setView(homeView)
    } else if (view === View.SignUp) {
      if (!canSignUp) setView(homeView)
    } else if (view === View.SignIn) {
      if (session && !session.loginRequired) setView(View.Authenticated)
    }
  }, [view, canSignUp, homeView, session])

  const value = useMemo<AuthenticationContextType | null>(() => {
    if (!session || session.loginRequired) return null
    return { session, sessions, canSwitchAccounts, api }
  }, [session, sessions, canSwitchAccounts, api])

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
          onValidateNewHandle={async (data) => {
            await api.validateHandleAvailability(data)
          }}
          onBack={showHome}
          onDone={async (data) => {
            await api.signUp(data)
            showHome()
          }}
        />
      )
    }

    if (view === View.ResetPassword) {
      return (
        <ResetPasswordView
          emailDefault={resetPasswordHint}
          initialView={resetPasswordConfirm ? 'confirm' : 'request'}
          onViewChange={(v) => setResetPasswordConfirm(v === 'confirm')}
          onResetPasswordRequest={async (data) => {
            await api.initiatePasswordReset(data)
          }}
          onResetPasswordConfirm={async (data) => {
            await api.confirmResetPassword(data)
          }}
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
        onSignIn={async (data) => {
          await api.signIn(data)
        }}
        onSignUp={showSignUpIfAllowed}
        onBack={homeView === View.SignIn ? onCancel : showHome}
        backLabel={homeView === View.SignIn ? <Trans>Cancel</Trans> : undefined}
        onForgotPassword={(email) => {
          setResetPasswordConfirm(false)
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

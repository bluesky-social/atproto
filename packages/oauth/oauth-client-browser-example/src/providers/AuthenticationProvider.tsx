import { type ReactNode, createContext, useContext } from 'react'
import type { OAuthSession } from '@atproto/oauth-client-browser'
import { AtmosphereSignInForm } from '../components/AtmosphereSignInForm.tsx'
import { Layout } from '../components/Layout.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { PDS_OPERATOR_URL } from '../constants.ts'
import { useDebounced } from '../lib/use-debounced.ts'
import { useOAuthContext } from './OAuthProvider.tsx'

export type AuthenticationValue = {
  session: OAuthSession
  signOut: () => Promise<void>
}

export const AuthenticationContext = createContext<AuthenticationValue | null>(
  null,
)
AuthenticationContext.displayName = 'AuthenticationContext'

/**
 * Provides a context that ensures that the user is signed in and has a valid
 * session. If the user is not signed in, a sign-in dialog will be displayed.
 */
export function AuthenticationProvider({ children }: { children?: ReactNode }) {
  const { isInitialized, session, signIn, signUp, signOut } = useOAuthContext(
    AuthenticationProvider.name,
  )

  // Create an artificial delay so that if a loading state is initially shown,
  // it does not disappear too quickly, causing a flicker effect.
  const ready = isInitialized
  const readyDebounced = useDebounced(ready, !ready ? 0 : 333)
  if (!readyDebounced) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <Spinner />
          Authenticating...
        </div>
      </Layout>
    )
  }

  if (!session) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center">
          <AtmosphereSignInForm
            pdsOperatorUrl={PDS_OPERATOR_URL}
            signIn={signIn}
            signUp={signUp}
          />
        </div>
      </Layout>
    )
  }

  return (
    <AuthenticationContext.Provider value={{ session, signOut }}>
      {children}
    </AuthenticationContext.Provider>
  )
}

export function useAuthenticationContext(
  hookName = useAuthenticationContext.name,
) {
  const context = useContext(AuthenticationContext)
  if (context) return context

  throw new Error(
    `${hookName} must be used within a ${AuthenticationContext.displayName}`,
  )
}

import { type ReactNode, createContext, useContext, useMemo } from 'react'
import type { OAuthSession } from '@atproto/oauth-client-browser'
import { AtmosphereSignInForm } from '../components/AtmosphereSignInForm.tsx'
import { Layout } from '../components/Layout.tsx'
import { PDS_OPERATOR_URL } from '../constants.ts'
import { useOAuthContext } from './OAuthProvider.tsx'

export type AuthenticationType = {
  session: OAuthSession
  signOut: () => Promise<void>
}

export const AuthenticationContext = createContext<AuthenticationType | null>(
  null,
)
AuthenticationContext.displayName = 'AuthenticationContext'

/**
 * Gates children behind an authentication flow. If the user is not signed in,
 * it will render a sign-in form. If the user is signed in, it will render the
 * children and provide the session and signOut function via context.
 */
export function AuthenticationProvider({ children }: { children?: ReactNode }) {
  const { session, signIn, signUp, signOut } = useOAuthContext(
    AuthenticationProvider.name,
  )

  const value = useMemo<AuthenticationType | null>(
    () => (session ? { session, signOut } : null),
    [session, signOut],
  )

  if (!value) {
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
    <AuthenticationContext.Provider value={value}>
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

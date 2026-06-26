import { ReactNode, createContext, useContext, useMemo } from 'react'
import { Client, DidString } from '@atproto/lex'
import { AtmosphereSignInDialog } from '../components/AtmosphereSignInDialog.tsx'
import { Layout } from '../components/Layout.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { PDS_OPERATOR_URL } from '../constants.ts'
import { useFlip } from '../lib/use-flip.ts'
import { OAuthProvider, useOAuthContext } from './OAuthProvider.tsx'

export type AuthenticatedClient = Client & { did: DidString }
export type AuthenticationContextType = AuthenticatedClient

export const AuthenticationContext =
  createContext<AuthenticationContextType | null>(null)
AuthenticationContext.displayName = 'AuthenticationContext'

export function AuthenticationProvider({ children }: { children?: ReactNode }) {
  return (
    <OAuthProvider>
      <AuthenticationProviderInternal>
        {children}
      </AuthenticationProviderInternal>
    </OAuthProvider>
  )
}

function AuthenticationProviderInternal({
  children,
}: {
  children?: ReactNode
}) {
  const { isLoading, session, signIn, signUp } = useOAuthContext()

  const client = useMemo<AuthenticationContextType | null>(() => {
    if (!session) return null

    const client: Client = new Client(session)
    client.assertAuthenticated()
    return client
  }, [session])

  // Create artificial delay (demo purposes)
  const ready = useFlip(client != null || !isLoading, { delay: 333 })

  if (!ready) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center">
          <Spinner />
          Loading authentication status...
        </div>
      </Layout>
    )
  }

  if (!client) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center">
          <AtmosphereSignInDialog
            signUpUrl={PDS_OPERATOR_URL}
            loading={isLoading}
            signIn={signIn}
            signUp={signUp}
          />
        </div>
      </Layout>
    )
  }

  return (
    <AuthenticationContext.Provider value={client}>
      {children}
    </AuthenticationContext.Provider>
  )
}

export function useAuthenticationContext(
  debugName = 'useAuthenticationContext',
) {
  const context = useContext(AuthenticationContext)
  if (context) return context

  throw new Error(
    `${debugName} must be used within a ${AuthenticationContext.displayName}`,
  )
}

export function useAuthenticatedClient(): AuthenticatedClient {
  const client: Client = useAuthenticationContext('useAuthenticatedClient')
  client.assertAuthenticated()
  return client
}

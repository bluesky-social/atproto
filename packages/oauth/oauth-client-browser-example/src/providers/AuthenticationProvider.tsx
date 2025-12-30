import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Client, DidString } from '@atproto/lex'
import { AtmosphereSignInDialog } from '../components/AtmosphereSignInDialog.tsx'
import { Layout } from '../components/Layout.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { SIGN_UP_URL } from '../constants.ts'
import * as app from '../lexicons/app.ts'
import { useAbortableEffect } from '../lib/use-abortable-effect.ts'
import { oauthClient } from '../oauthClient.ts'
import { OAuthProvider, useOAuthContext } from './OAuthProvider.tsx'

export type AuthenticatedClient = Client & { did: DidString }
export type AuthenticationContextType = {
  client: AuthenticatedClient
}

export const AuthenticationContext =
  createContext<AuthenticationContextType | null>(null)
AuthenticationContext.displayName = 'AuthenticationContext'

export function AuthenticationProvider({ children }: { children?: ReactNode }) {
  return (
    <OAuthProvider client={oauthClient}>
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
  const [initialized, setInitialized] = useState(false)
  const [configuredClient, setConfiguredClient] =
    useState<AuthenticatedClient | null>(null)

  // As soon as initial loading/configuration is done, we are "initialized"
  const isConfiguring = session != null && configuredClient == null
  useEffect(() => {
    if (!isLoading && !isConfiguring) setInitialized(true)
  }, [isLoading, isConfiguring])

  const client = useMemo(
    () => (session ? new Client(session) : null),
    [session],
  )

  useAbortableEffect(
    (signal) => {
      if (client) {
        void configureClient(client, signal).then(
          (client) => {
            if (!signal.aborted) setConfiguredClient(client)
          },
          () => {
            // Most likely aborted, ignore
          },
        )
      } else {
        setConfiguredClient(null)
      }
    },
    [client],
  )

  const valueClient =
    session && client && configuredClient === client ? configuredClient : null
  const value = useMemo<AuthenticationContextType | null>(() => {
    if (valueClient) return { client: valueClient }
    return null
  }, [valueClient])

  if (value) {
    return (
      <AuthenticationContext.Provider value={value}>
        {children}
      </AuthenticationContext.Provider>
    )
  }

  return (
    <Layout>
      <div className="flex flex-grow flex-col items-center justify-center">
        {initialized ? (
          <AtmosphereSignInDialog
            signUpUrl={SIGN_UP_URL}
            loading={isLoading || isConfiguring}
            signIn={signIn}
            signUp={signUp}
          />
        ) : (
          <Spinner />
        )}
      </div>
    </Layout>
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

async function configureClient(
  client: Client,
  signal: AbortSignal,
): Promise<AuthenticatedClient> {
  const { preferences } = await getPreferences(client, signal)

  const labelers = preferences
    .findLast((v) => app.bsky.actor.defs.labelersPref.matches(v))
    ?.labelers.map((l) => l.did)

  client.setLabelers(labelers)
  client.assertAuthenticated()

  console.info('Configured client with labelers:', labelers)

  return client
}

async function getPreferences(client: Client, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.call(app.bsky.actor.getPreferences, {}, { signal })
    } catch (err) {
      // TODO handle 403 ?
      signal.throwIfAborted()
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(200 * 1.5 ** attempt, 5000)),
      )
    }
  }
}

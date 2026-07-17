import { createContext, useContext, useMemo, useState } from 'react'
import { type Agent, Client } from '@atproto/lex'
import { asDid } from '@atproto/oauth-client-browser'
import { Layout } from '../components/Layout.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { BSKY_API_DID, BSKY_API_URL } from '../constants.ts'
import * as app from '../lexicons/app.ts'
import { useAbortableEffect } from '../lib/use-abortable-effect.ts'
import { useDebounced } from '../lib/use-debounced.ts'
import { useOAuthContext } from './OAuthProvider.tsx'

const BSKY_APPVIEW_DID_SERVICE = `${asDid(BSKY_API_DID)}#bsky_appview` as const

const unauthenticatedClient = new Client(BSKY_API_URL)

const BskyClientContext = createContext<Client>(unauthenticatedClient)
BskyClientContext.displayName = 'BskyClientContext'

export function BskyClientProvider({
  children,
}: {
  children?: React.ReactNode
}) {
  // @NOTE The OAuthProvider "session" is used as agent for the Bsky client.
  // The client's own configuration (service, labelers, headers) is scoped to
  // this client instance and does not affect other clients built from the
  // same session (e.g. the PdsClientProvider's client).
  const { session } = useOAuthContext(BskyClientProvider.name)
  const { client, configuring } = useConfiguredClient(session)

  // Create an artificial delay so that if a loading state is initially shown,
  // it does not disappear too quickly, causing a flicker effect.
  const ready = !configuring
  const readyDebounced = useDebounced(ready, !ready ? 0 : 333)
  if (!readyDebounced) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <Spinner />
          Loading preferences...
        </div>
      </Layout>
    )
  }

  return (
    <BskyClientContext.Provider value={client}>
      {children}
    </BskyClientContext.Provider>
  )
}

/**
 * Returns a {@link Client} instance that is configured with the current user's
 * session (if any). If the user is not signed in, an unauthenticated client
 * will be returned. Use {@link Client.did} to check if the client is
 * authenticated.
 */
export function useBskyClient() {
  return useContext(BskyClientContext)
}

export function useUnauthenticatedBskyClient() {
  return unauthenticatedClient
}

/**
 * Can only be used from within an authenticated context
 * ({@link AuthenticationContext} or {@link OAuthContext}).
 */
export function useAuthenticatedBskyClient() {
  const client: Client = useBskyClient()
  client.assertAuthenticated()
  return client
}

function useConfiguredClient(agent: Agent | null) {
  const client = useMemo(() => {
    return agent
      ? new Client(agent, { service: BSKY_APPVIEW_DID_SERVICE })
      : unauthenticatedClient
  }, [agent, unauthenticatedClient])

  const [configuring, setConfiguring] = useState(
    client !== unauthenticatedClient,
  )

  useAbortableEffect(
    (signal) => {
      setConfiguring(true)
      if (client.did) {
        void configureClient(client, signal)
          .catch((err) => {
            console.error('Failed to configure Bsky client', err)
          })
          .finally(() => {
            if (!signal.aborted) setConfiguring(false)
          })
      }
    },
    [client],
  )

  return {
    client,
    configuring: client === unauthenticatedClient ? false : configuring,
  }
}

async function configureClient(client: Client, signal: AbortSignal) {
  // Fetch preferences and configure the client with labelers

  const { body } = await client.xrpc(app.bsky.actor.getPreferences, {
    signal,
    maxRetries: 5,
  })

  const labelers = body.preferences
    .findLast(app.bsky.actor.defs.labelersPref.$isTypeOf)
    ?.labelers.map((l) => l.did)

  client.setLabelers(labelers)
}

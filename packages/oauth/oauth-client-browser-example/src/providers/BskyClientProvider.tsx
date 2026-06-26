import { createContext, useContext, useState } from 'react'
import { Agent, Client } from '@atproto/lex'
import { asDid } from '@atproto/oauth-client-browser'
import { Layout } from '../components/Layout.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { BSKY_API_DID, BSKY_API_URL } from '../constants.ts'
import * as app from '../lexicons/app.ts'
import { useAbortableEffect } from '../lib/use-abortable-effect.ts'
import { useFlip } from '../lib/use-flip.ts'
import {
  AuthenticatedClient,
  useAuthenticatedClient,
} from './AuthenticationProvider.tsx'

const BSKY_APPVIEW_DID_SERVICE = `${asDid(BSKY_API_DID)}#bsky_appview` as const

const unauthenticatedClient = new Client(BSKY_API_URL)

const BskyClientContext = createContext<Client>(unauthenticatedClient)
BskyClientContext.displayName = 'BskyClientContext'

export function BskyClientProvider({
  children,
}: {
  children?: React.ReactNode
}) {
  // @NOTE We prefer using an AuthenticationContext "PDS client" instead of the
  // OAuthProvider "session" as agent to ensure that any configuration (e.g.
  // labelers, etc.) on the PDS client is preserved and applied to the
  // BskyClient context value as well.
  const agent = useAuthenticatedClient()

  const [client, setClient] = useState<AuthenticatedClient | null>(null)

  // Create artificial delay (demo purposes)
  const ready = useFlip(client != null, { delay: 333 })

  useAbortableEffect(
    (signal) => {
      void buildClient(agent, signal).then((client) => {
        if (!signal.aborted) setClient(client)
      })
    },
    [agent],
  )

  if (!client || !ready) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center">
          <Spinner />
          Loading Bluesky preferences...
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

async function buildClient(
  agent: Agent,
  signal: AbortSignal,
): Promise<AuthenticatedClient> {
  const client: Client = new Client(agent, {
    service: BSKY_APPVIEW_DID_SERVICE,
  })

  client.assertAuthenticated()

  // Fetch preferences and configure the client with labelers
  try {
    const { preferences } = await getPreferences(client, signal)

    const labelers = preferences
      .findLast(app.bsky.actor.defs.labelersPref.$isTypeOf)
      ?.labelers.map((l) => l.did)

    client.setLabelers(labelers)

    console.info('Configured client with labelers:', labelers)
  } catch (err) {
    console.error('Failed to get preferences, using default labelers', err)
  }

  return client
}

async function getPreferences(client: Client, signal: AbortSignal) {
  const start = Date.now()
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.call(app.bsky.actor.getPreferences, {}, { signal })
    } catch (err) {
      if (signal.aborted) throw err
      if (Date.now() - start > 7_000) throw err

      // TODO handle 403 ?
      console.warn('Failed to get preferences, retrying...', err)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(200 * 1.5 ** attempt, 5000)),
      )

      signal.throwIfAborted()
    }
  }
}

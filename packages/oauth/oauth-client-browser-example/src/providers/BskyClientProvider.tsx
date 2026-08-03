import { type PropsWithChildren, createContext, use, useContext } from 'react'
import { type Agent, Client } from '@atproto/lex'
import { type OAuthSession, asDid } from '@atproto/oauth-client-browser'
import { BSKY_API_DID, BSKY_API_URL } from '../constants.ts'
import * as app from '../lexicons/app.ts'
import { useOAuthContext } from './OAuthProvider.tsx'

const BSKY_APPVIEW_DID_SERVICE = `${asDid(BSKY_API_DID)}#bsky_appview` as const

const unauthenticatedClient = new Client(BSKY_API_URL)

const BskyClientContext = createContext(unauthenticatedClient)
BskyClientContext.displayName = 'BskyClientContext'

export function BskyClientProvider({ children }: PropsWithChildren) {
  // @NOTE The OAuthProvider "session" is used as agent for the Bsky client.
  // The client's own configuration (service, labelers, headers) is scoped to
  // this client instance and does not affect other clients built from the
  // same session (e.g. the PdsClientProvider's client).
  const { session } = useOAuthContext(BskyClientProvider.name)
  const client = useConfiguredClient(session)

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

/**
 * Can only be used from within an authenticated context
 * ({@link AuthenticationContext} or {@link OAuthContext}).
 */
export function useAuthenticatedBskyClient(
  hookName = useAuthenticatedBskyClient.name,
) {
  const client: Client = useBskyClient()
  try {
    client.assertAuthenticated()
    return client
  } catch (cause) {
    throw new Error(
      `${hookName} must be used within an authenticated context`,
      { cause },
    )
  }
}

const unauthenticatedClientPromise = Promise.resolve(unauthenticatedClient)
const cache = new WeakMap<Agent, Promise<Client>>()

function useConfiguredClient(session?: OAuthSession): Client {
  // @NOTE The use of promises created in render, without a framework (like
  // NextJS), requires to use stable (cached) promises. Since oauth sessions are
  // stable objects, it is safe to use them as cache key to provide a stable
  // promise for `use()`.

  let promise: Promise<Client>
  if (session) {
    if (!cache.has(session)) cache.set(session, buildClient(session))
    promise = cache.get(session)!
  } else {
    promise = unauthenticatedClientPromise
  }

  return use(promise)
}

async function buildClient(session: OAuthSession) {
  const client = new Client(session, { service: BSKY_APPVIEW_DID_SERVICE })
  await configureClient(client)
  return client
}

async function configureClient(client: Client, signal?: AbortSignal) {
  try {
    const { body } = await client.xrpc(app.bsky.actor.getPreferences, {
      maxRetries: 5,
      signal,
    })

    const labelers = body.preferences
      .findLast(app.bsky.actor.defs.labelersPref.$isTypeOf)
      ?.labelers.map((l) => l.did)

    client.setLabelers(labelers)
  } catch (err) {
    console.error('Failed to fetch preferences for BskyClientProvider', err)
  }
}

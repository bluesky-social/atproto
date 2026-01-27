import { createContext, useContext, useMemo } from 'react'
import { Client } from '@atproto/lex'
import { asDid } from '@atproto/oauth-client-browser'
import { BSKY_API_DID, BSKY_API_URL } from '../constants.ts'
import { useAuthenticationContext } from './AuthenticationProvider.tsx'

const BSKY_APPVIEW_DID_SERVICE = `${asDid(BSKY_API_DID)}#bsky_appview` as const

const unauthenticatedClient = new Client(BSKY_API_URL)

const BskyClientContext = createContext<Client>(unauthenticatedClient)
BskyClientContext.displayName = 'BskyClientContext'

export function BskyClientProvider({
  children,
}: {
  children?: React.ReactNode
}) {
  // @NOTE We prefer using an AuthenticationContext "client" instead of the
  // OAuthProvider "session" as agent to ensure that any configuration (e.g.
  // labelers, etc.) on the client is preserved and applied to the BskyClient
  // context value as well.
  const agent = useAuthenticationContext().client

  const value = useMemo(() => {
    return agent
      ? new Client(agent, { service: BSKY_APPVIEW_DID_SERVICE })
      : unauthenticatedClient
  }, [agent])

  return (
    <BskyClientContext.Provider value={value}>
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

import { Agent } from '@atproto/api'
import { createContext, PropsWithChildren, useContext, useMemo } from 'react'
import { useSession } from './SessionProvider'

/**
 * An unauthenticated {@link Agent} instance, that can be used to perform
 * unauthenticated requests directly towards the Bluesky API.
 */
const unauthenticatedAgent = new Agent('https://api.bsky.app')

const BskyAgentContext = createContext(unauthenticatedAgent)

export function BskyAgentProvider({ children }: PropsWithChildren) {
  const { session } = useSession()

  /**
   * An agent that will perform authenticated requests towards the Bluesky
   * API, by proxying requests through the user's PDS.
   *
   * @note Requires that at least one `rpc:` OAuth scope with
   * `aud=did:web:api.bsky.app#bsky_appview` is granted during the OAuth flow,
   * otherwise the PDS will reject any proxying attempts.
   */
  const authenticatedAgent = useMemo(() => {
    if (!session) return null
    const agent: Agent = new Agent(session)
    agent.assertAuthenticated()
    agent.configureProxy('did:web:api.bsky.app#bsky_appview')
    return agent
  }, [session])

  return (
    <BskyAgentContext.Provider
      value={authenticatedAgent || unauthenticatedAgent}
    >
      {children}
    </BskyAgentContext.Provider>
  )
}

/**
 * Returns an unauthenticated {@link Agent} to perform requests towards the
 * Bluesky API. Using an unauthenticated agent will result in faster requests
 * (since no proxying will be involved), but only public data can be accessed.
 */
export function useUnauthenticatedBskyAgent() {
  return unauthenticatedAgent
}

/**
 * Returns an {@link Agent} to perform requests towards the Bluesky API. Use
 * {@link Agent.did `agent.did`} to determine if the agent is authenticated or
 * not (if `undefined`, the agent is unauthenticated).
 */
export function useBskyAgent() {
  return useContext(BskyAgentContext)
}

/**
 * Like {@link useBskyAgent}, but will throw if the agent is not authenticated
 * (i.e. used from non-logged in routes). Allows to retrieve the currently
 * authenticated user's DID by accessing {@link Agent.did `agent.did`}.
 */
export function useAuthenticatedBskyAgent() {
  const agent: Agent = useBskyAgent()
  agent.assertAuthenticated()
  return agent
}

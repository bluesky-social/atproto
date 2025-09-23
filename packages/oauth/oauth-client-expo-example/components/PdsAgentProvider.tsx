import { Agent } from '@atproto/api'
import { createContext, PropsWithChildren, useContext, useMemo } from 'react'
import { useSession } from './SessionProvider'

export type PdsAgent = Agent & { did: string }

export const PdsAgentContext = createContext<PdsAgent | null>(null)

export function PdsAgentProvider({ children }: PropsWithChildren) {
  const { session } = useSession()

  const agent = useMemo<PdsAgent | null>(() => {
    if (!session) return null
    const agent: Agent = new Agent(session)
    agent.assertAuthenticated()
    return agent
  }, [session])

  return (
    <PdsAgentContext.Provider value={agent}>
      {children}
    </PdsAgentContext.Provider>
  )
}

/**
 * Returns an authenticated {@link Agent} to perform requests towards the
 * user's PDS. Will throw if used outside of an authenticated context.
 */
export function usePdsAgent(): PdsAgent {
  const agent = useContext(PdsAgentContext)
  if (agent) return agent

  throw new Error('usePdsAgent should only be used from authenticated contexts')
}

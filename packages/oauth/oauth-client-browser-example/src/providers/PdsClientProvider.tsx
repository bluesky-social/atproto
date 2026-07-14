import { type ReactNode, createContext, useContext, useMemo } from 'react'
import { Client, type DidString } from '@atproto/lex'
import { useOAuthSession } from './OAuthProvider.tsx'

export type AuthenticatedClient = Client & { did: DidString }
export type PdsClientContextType = AuthenticatedClient

export const PdsClientContext = createContext<PdsClientContextType | null>(null)
PdsClientContext.displayName = 'PdsClientContext'

export function PdsClientProvider({ children }: { children?: ReactNode }) {
  const session = useOAuthSession(PdsClientProvider.name)

  const client = useMemo(() => {
    const client: Client = new Client(session)
    client.assertAuthenticated()
    return client
  }, [session])

  return (
    <PdsClientContext.Provider value={client}>
      {children}
    </PdsClientContext.Provider>
  )
}

export function usePdsClient(
  hookName = usePdsClient.name,
): AuthenticatedClient {
  const client = useContext(PdsClientContext)
  if (client) return client

  throw new Error(
    `${hookName} must be used within a ${PdsClientContext.displayName}`,
  )
}

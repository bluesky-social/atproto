import { type ReactNode, createContext, useContext, useMemo } from 'react'
import { Client, type DidString } from '@atproto/lex'
import { useAuthenticationContext } from './AuthenticationProvider.tsx'

export type PdsClientType = Client & { did: DidString }
export const PdsClientContext = createContext<PdsClientType | null>(null)
PdsClientContext.displayName = 'PdsClientContext'

export function PdsClientProvider({ children }: { children?: ReactNode }) {
  const { session } = useAuthenticationContext(PdsClientProvider.name)

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

export function usePdsClient(hookName = usePdsClient.name): PdsClientType {
  const client = useContext(PdsClientContext)
  if (client) return client

  throw new Error(
    `${hookName} must be used within a ${PdsClientContext.displayName}`,
  )
}

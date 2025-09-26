import { useBrowserWarmUp } from '@/utils/useBrowserWarmUp'
import type { OAuthSession } from '@atproto/oauth-client'
import type { ExpoOAuthClient } from '@atproto/oauth-client-expo'
import * as store from 'expo-secure-store'
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

const CURRENT_AUTH_DID = 'oauth_provider-current'

const SessionContext = createContext<{
  session: null | OAuthSession
  isLoading: boolean
  isLoggedIn: boolean
  signIn: (input: string) => Promise<void>
  signOut: () => Promise<void>
}>({
  session: null,
  isLoading: false,
  isLoggedIn: false,
  signIn: async () => {
    throw new Error('AuthContext not initialized')
  },
  signOut: async () => {
    throw new Error('AuthContext not initialized')
  },
})

export function SessionProvider({
  client,
  children,
}: PropsWithChildren<{
  client: ExpoOAuthClient
}>) {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<null | OAuthSession>(null)

  // Make sure the browser is warmed up when we might need it
  useBrowserWarmUp(initialized && !loading && !session)

  // Initialize by restoring the previously loaded session, if any.
  useEffect(() => {
    setInitialized(false)
    setSession(null)
    void store
      .getItemAsync(CURRENT_AUTH_DID)
      .then((lastDid) => {
        // Use "false" as restore argument to allow the app to work off-line
        if (lastDid) return client.restore(lastDid, false)
        else return null
      })
      .catch((err) => {
        console.error('Error loading stored atproto session', err)
        return null
      })
      .then((session) => {
        setSession(session)
      })
      .finally(() => {
        setInitialized(true)
        setLoading(false)
      })
  }, [client])

  // If the current session gets deleted (e.g. from another browser tab, or
  // because a refresh token was revoked), clear it
  useEffect(() => {
    if (!session) return

    const handleDelete = (event: CustomEvent<{ sub: string }>) => {
      if (event.detail.sub === session.did) {
        setSession(null)
        void store.deleteItemAsync(CURRENT_AUTH_DID)
      }
    }

    client.addEventListener('deleted', handleDelete)
    return () => {
      client.removeEventListener('deleted', handleDelete)
    }
  }, [client, session])

  // When initializing the AuthProvider, we used "false" as restore's refresh
  // argument so that the app can work off-line. The following effect will
  // ensure that the session is pro actively refreshed whenever the app gets
  // back online.
  useEffect(() => {
    if (!session) return

    // @NOTE If the refresh token was revoked, the "deleted" event will be
    // triggered on the client, causing the previous effect to clear the session
    const check = () => {
      void session.getTokenInfo(true).catch((err) => {
        console.warn('Failed to refresh token', err)
      })
    }

    check()

    const interval = setInterval(check, 10 * 60e3)
    return () => clearInterval(interval)
  }, [session])

  const signIn = useCallback(
    async (input: string) => {
      setLoading(true)

      try {
        const session = await client.restore(input, true).catch(async (err) => {
          const result = await client.signIn(input)
          if (result.status === 'success') return result.session
          throw new Error(`Failed to sign in: ${result.status}`)
        })

        setSession(session)
        await store.setItemAsync(CURRENT_AUTH_DID, session.did)
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  const signOut = useCallback(async () => {
    if (session) {
      setSession(null)
      setLoading(true)
      try {
        await session.signOut()
      } finally {
        setLoading(false)
      }
      await store.deleteItemAsync(CURRENT_AUTH_DID)
    }
  }, [session])

  return (
    <SessionContext.Provider
      value={{
        session,

        isLoading: !initialized || loading,
        isLoggedIn: !!session,

        signIn,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}

export function useOAuthSession(): OAuthSession {
  const { session } = useSession()
  if (!session) throw new Error('User is not logged in')
  return session
}

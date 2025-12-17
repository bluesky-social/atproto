import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser'

export type SignInFunction = (
  input: string,
  options?: { display?: 'popup' },
) => Promise<void>
export type SignUpFunction = (
  input: string,
  options?: { display?: 'popup' },
) => Promise<void>
export type SignOutFunction = () => Promise<void>

export const OAuthContext = createContext<null | {
  session: null | OAuthSession
  isLoading: boolean
  isSignedIn: boolean
  signIn: SignInFunction
  signUp: SignUpFunction
  signOut: SignOutFunction
}>(null)

export function OAuthProvider({
  client,
  children,
}: PropsWithChildren<{
  client: BrowserOAuthClient
}>) {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<null | OAuthSession>(null)

  const clientInitRef = useRef<typeof client>(null)

  // Initialize by restoring the previously loaded session, if any.
  useEffect(() => {
    // In strict mode, we don't want to re-init() the client if it's the same
    if (clientInitRef.current === client) return
    clientInitRef.current = client

    setInitialized(false)
    setSession(null)

    void client
      .init(false)
      .then(async (result) => {
        if (clientInitRef.current !== client) return

        setInitialized(true)

        if (!result) return
        const { session } = result

        setSession(session)

        // If we are not back from a redirect, force an async refresh here,
        // which will cause the session to be deleted by the "deleted" event
        // handler if the refresh token was revoked
        if (result.state === undefined) void session.getTokenInfo(true)
      })
      .catch((err) => {
        if (clientInitRef.current !== client) return

        console.warn('Error during OAuth client initialization:', err)

        setInitialized(true)
      })
  }, [client])

  // If the current session gets deleted (e.g. from another browser tab, or
  // because a refresh token was revoked), clear it
  useEffect(() => {
    if (!session) return

    const handleDelete = (event: CustomEvent<{ sub: string }>) => {
      if (event.detail.sub === session.did) {
        setSession(null)
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
        console.warn('Failed to refresh OAuth session token info:', err)
      })
    }

    const interval = setInterval(check, 10 * 60e3)
    return () => clearInterval(interval)
  }, [session])

  const signIn = useCallback<SignInFunction>(
    async (input, options) => {
      setLoading(true)

      try {
        const session = await client
          .restore(input, true)
          .catch(async (_err) => client.signIn(input, options))

        setSession(session)
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  const signOut = useCallback<SignOutFunction>(async () => {
    if (session) {
      setSession(null)
      setLoading(true)
      try {
        await session.signOut()
      } finally {
        setLoading(false)
      }
    }
  }, [session])

  const signUp = useCallback<SignUpFunction>(
    async (input, options) => {
      setLoading(true)
      try {
        const session = await client.signIn(input, {
          ...options,
          prompt: 'create',
        })

        setSession(session)
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  return (
    <OAuthContext.Provider
      value={{
        session,

        isLoading: !initialized || loading,
        isSignedIn: !!session,

        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </OAuthContext.Provider>
  )
}

export function useOAuthContext() {
  const value = useContext(OAuthContext)
  if (!value) throw new Error('useOAuth must be used within an OAuthProvider')
  return value
}

export function useOAuthSession(): OAuthSession {
  const { session } = useOAuthContext()
  if (!session) throw new Error('User is not logged in')
  return session
}

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { type OAuthSession } from '@atproto/oauth-client-browser'
import { useAbortableEffect } from '../lib/use-abortable-effect'
import { initPromise, oauthClient, oauthEvents } from '../oauthClient'

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

export function OAuthProvider({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<null | OAuthSession>(null)

  // Initialize by restoring the previously loaded session, if any.
  useAbortableEffect(
    (signal) => {
      setInitialized(false)
      setSession(null)

      void initPromise
        .then(async (result) => {
          if (signal.aborted) return

          if (result) setSession(result.session)
        })
        .finally(() => {
          if (signal.aborted) return

          setInitialized(true)
        })
    },
    [initPromise],
  )

  useAbortableEffect(
    (signal) => {
      oauthEvents.addEventListener(
        'deleted',
        (evt: CustomEvent<{ sub: string; cause: unknown }>) => {
          setSession((session) =>
            evt.detail.sub === session?.sub ? null : session,
          )
        },
        { signal },
      )
    },
    [oauthEvents],
  )

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
        const session = await oauthClient
          .restore(input, true)
          .catch(async (_err) => oauthClient.signIn(input, options))

        setSession(session)
      } finally {
        setLoading(false)
      }
    },
    [oauthClient],
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
        const session = await oauthClient.signIn(input, {
          ...options,
          prompt: 'create',
        })

        setSession(session)
      } finally {
        setLoading(false)
      }
    },
    [oauthClient],
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

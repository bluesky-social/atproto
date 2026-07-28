import {
  type PropsWithChildren,
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { OAuthSession } from '@atproto/oauth-client-browser'
import { useAbortableEffect } from '../lib/use-abortable-effect.js'
import { initPromise, oauthClient, oauthEvents } from '../oauthClient.js'

export type SignInFunction = (
  input: string,
  options?: { display?: 'popup' },
) => Promise<void>
export type SignUpFunction = (
  input: string,
  options?: { display?: 'popup' },
) => Promise<void>
export type SignOutFunction = () => Promise<void>

export type OAuthValue = {
  /** State saved when we last left this app to complete the oauth flow */
  state?: string | null
  session?: OAuthSession

  signIn: SignInFunction
  signUp: SignUpFunction
  signOut: SignOutFunction
}

export const OAuthContext = createContext<null | OAuthValue>(null)
OAuthContext.displayName = 'OAuthContext'

export type OAuthProviderProps = PropsWithChildren

export function OAuthProvider({ children }: OAuthProviderProps) {
  const initSession = use(initPromise)

  const state = initSession?.state
  const [session, setSession] = useState(initSession?.session)

  // Keep tabs in sync by listening to the oauth client's events and updating
  // the session state accordingly. The deletion part is needed because the
  // oauth client internal data is shared across tabs, so if a session is
  // deleted in one tab, the other tabs should reflect that change as well. The
  // update part is optional.
  useAbortableEffect(
    (signal) => {
      // If the session is removed from another tab, we should update the state
      // in this tab as well.
      if (session) {
        oauthEvents.addEventListener(
          'deleted',
          (evt) => {
            if (evt.detail.sub === session.sub) setSession(undefined)
          },
          { signal },
        )
      } else {
        // If we don't have a session, and one is refreshed in another tab,
        // let's load it in the current tab as well.
        oauthEvents.addEventListener(
          'updated',
          (evt) => {
            void oauthClient.restore(evt.detail.sub, false).then((session) => {
              if (!signal.aborted) setSession(session)
            })
          },
          { signal },
        )
      }
    },
    [oauthEvents, session],
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
      const session = await oauthClient
        .restore(input, true)
        .catch(async (_err) => oauthClient.signIn(input, options))

      setSession(session)
    },
    [oauthClient],
  )

  const signOut = useCallback<SignOutFunction>(async () => {
    if (session) {
      setSession(undefined)
      await session.signOut()
    }
  }, [session])

  const signUp = useCallback<SignUpFunction>(
    async (input, options) => {
      const session = await oauthClient.signIn(input, {
        ...options,
        prompt: 'create',
      })

      setSession(session)
    },
    [oauthClient],
  )

  const value = useMemo<OAuthValue | null>(
    () => ({ session, state, signIn, signUp, signOut }),
    [session, state, signIn, signUp, signOut],
  )

  return <OAuthContext.Provider value={value}>{children}</OAuthContext.Provider>
}

export function useOAuthContext(hookName = useOAuthContext.name) {
  const value = useContext(OAuthContext)
  if (value) return value

  throw new Error(
    `${hookName} must be used within an ${OAuthContext.displayName}`,
  )
}

export function useOAuthSession(hookName = useOAuthSession.name): OAuthSession {
  const { session } = useOAuthContext(hookName)
  if (session) return session

  throw new Error(`${hookName} must be used within an authenticated context`)
}

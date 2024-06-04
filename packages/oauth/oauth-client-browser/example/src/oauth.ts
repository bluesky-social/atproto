import { AuthorizeOptions, OAuthAgent, Session } from '@atproto/oauth-client'
import {
  BrowserOAuthClient,
  LoginContinuedInParentWindowError,
} from '@atproto/oauth-client-browser'
import { useCallback, useEffect, useRef, useState } from 'react'

const CURRENT_SESSION_ID_KEY = 'CURRENT_SESSION_ID_KEY'

export function useOAuth(client: BrowserOAuthClient) {
  const [oauthAgent, setOAuthAgent] = useState<undefined | null | OAuthAgent>(
    void 0,
  )
  const [error, setError] = useState<null | string>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<undefined | string>(undefined)

  useEffect(() => {
    // Ignore init step
    if (oauthAgent === undefined) return

    if (oauthAgent) {
      localStorage.setItem(CURRENT_SESSION_ID_KEY, oauthAgent.sessionId)
    } else {
      localStorage.removeItem(CURRENT_SESSION_ID_KEY)
    }
  }, [oauthAgent])

  const clientRef = useRef<typeof client>()
  useEffect(() => {
    // In strict mode, we don't want to reinitialize the client if it's the same
    if (clientRef.current === client) return
    clientRef.current = client

    setOAuthAgent(undefined)
    setError(null)
    setLoading(true)
    setState(undefined)

    client
      .init(localStorage.getItem(CURRENT_SESSION_ID_KEY) || undefined)
      .then(async (r) => {
        if (clientRef.current !== client) return

        setOAuthAgent(r?.agent || null)
        setState(r?.state)
      })
      .catch((err) => {
        console.error('Failed to init:', err)

        if (clientRef.current !== client) return
        if (err instanceof LoginContinuedInParentWindowError) return

        localStorage.removeItem(CURRENT_SESSION_ID_KEY)
        setOAuthAgent(null)
        setError(String(err))
      })
      .finally(() => {
        if (clientRef.current !== client) return

        setLoading(false)
      })
  }, [client])

  useEffect(() => {
    if (!oauthAgent) return

    return client.onSession((event, sessionId, session?: Session): void => {
      if (
        (event === 'revoked' || event === 'deleted') &&
        sessionId === oauthAgent.sessionId
      ) {
        setOAuthAgent(null)
        setError(null)
        setLoading(true)
        setState(undefined)
      }
    })
  }, [client, oauthAgent])

  const signOut = useCallback(async () => {
    if (!oauthAgent) return

    setOAuthAgent(null)
    setError(null)
    setLoading(true)
    setState(undefined)

    try {
      await oauthAgent.signOut()
    } catch (err) {
      console.error('Failed to clear credentials', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [oauthAgent])

  const signIn = useCallback(
    async (input: string, options?: AuthorizeOptions) => {
      if (oauthAgent) return

      setLoading(true)
      setState(undefined)

      try {
        const agent = await client.signIn(input, options)
        setOAuthAgent(agent)
      } catch (err) {
        console.error('Failed to login', err)
        setError(String(err))
      } finally {
        setLoading(false)
      }
    },
    [oauthAgent, client],
  )

  return {
    initialized: oauthAgent !== undefined,
    oauthAgent: oauthAgent ?? null,
    state,
    loading,
    error,
    signedIn: oauthAgent != null,
    signIn,
    signOut,
  }
}

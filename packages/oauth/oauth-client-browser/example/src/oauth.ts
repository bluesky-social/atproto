import { OAuthAgent, AuthorizeOptions } from '@atproto/oauth-client'
import {
  BrowserOAuthClient,
  LoginContinuedInParentWindowError,
} from '@atproto/oauth-client-browser'
import { useCallback, useEffect, useRef, useState } from 'react'

const CURRENT_AUTHENTICATED_SUB = 'CURRENT_AUTHENTICATED_SUB'

export function useOAuth(client: BrowserOAuthClient) {
  const [agent, setAgent] = useState<null | OAuthAgent>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ignore init step
    if (loading) return

    if (agent) {
      localStorage.setItem(CURRENT_AUTHENTICATED_SUB, agent.sub)
    } else {
      localStorage.removeItem(CURRENT_AUTHENTICATED_SUB)
    }
  }, [loading, agent])

  const clientRef = useRef<typeof client>()
  useEffect(() => {
    // In strict mode, we don't want to reinitialize the client if it's the same
    if (clientRef.current === client) return
    clientRef.current = client

    setLoading(true)
    setAgent(null)

    const subToLoad =
      localStorage.getItem(CURRENT_AUTHENTICATED_SUB) || undefined

    client
      .init(subToLoad)
      .then(async (r) => {
        if (clientRef.current !== client) return

        setAgent(r?.agent || null)
      })
      .catch((err) => {
        console.error('Failed to init:', err)

        if (clientRef.current !== client) return
        if (err instanceof LoginContinuedInParentWindowError) return

        localStorage.removeItem(CURRENT_AUTHENTICATED_SUB)
        setAgent(null)
      })
      .finally(() => {
        if (clientRef.current !== client) return

        setLoading(false)
      })
  }, [client])

  useEffect(() => {
    if (!agent) return

    const clear = ({ detail }: { detail: { sub: string } }) => {
      if (detail.sub === agent.sub) {
        setAgent(null)
        setLoading(true)
      }
    }

    client.addEventListener('deleted', clear)

    return () => {
      client.removeEventListener('deleted', clear)
    }
  }, [client, agent])

  const signOut = useCallback(async () => {
    if (!agent) return

    setAgent(null)
    setLoading(true)

    try {
      await agent.signOut()
    } catch (err) {
      console.error('Failed to clear credentials', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [agent])

  const signIn = useCallback(
    async (input: string, options?: AuthorizeOptions) => {
      if (agent) return

      setLoading(true)

      try {
        const agent = await client.signIn(input, options)
        setAgent(agent)
      } catch (err) {
        console.error('Failed to login', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [agent, client],
  )

  return {
    agent,
    loading,
    signedIn: agent != null,
    signIn,
    signOut,
  }
}

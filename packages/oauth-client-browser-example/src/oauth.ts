import { OAuthAuthorizeOptions, OAuthClient } from '@atproto/oauth-client'
import { BrowserOAuthClientFactory } from '@atproto/oauth-client-browser'
import { useCallback, useEffect, useRef, useState } from 'react'

const CURRENT_SESSION_ID_KEY = 'CURRENT_SESSION_ID_KEY'

export function useOAuth(factory: BrowserOAuthClientFactory) {
  const [client, setClient] = useState<undefined | null | OAuthClient>(void 0)
  const [clients, setClients] = useState<{ [_: string]: OAuthClient }>({})
  const [error, setError] = useState<null | string>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<undefined | string>(undefined)

  const semaphore = useRef(0)

  useEffect(() => {
    if (client != null) {
      localStorage.setItem(CURRENT_SESSION_ID_KEY, client.sessionId)
    } else if (client === null) {
      localStorage.removeItem(CURRENT_SESSION_ID_KEY)
    }
  }, [client])

  useEffect(() => {
    semaphore.current++

    setClient(undefined)
    setClients({})
    setError(null)
    setLoading(true)
    setState(undefined)

    const sessionId = localStorage.getItem(CURRENT_SESSION_ID_KEY)
    factory
      .init(sessionId || undefined)
      .then(async (r) => {
        const clients = await factory.restoreAll().catch((err) => {
          console.error('Failed to restore clients:', err)
          return {}
        })
        setClients(clients)
        setClient(r?.client || (sessionId && clients[sessionId]) || null)
        setState(r?.state)
      })
      .catch((err) => {
        localStorage.removeItem(CURRENT_SESSION_ID_KEY)
        console.error('Failed to init:', err)
        setError(String(err))
      })
      .finally(() => {
        setLoading(false)
        semaphore.current--
      })
  }, [semaphore, factory])

  const signOut = useCallback(async () => {
    if (!client) return

    if (semaphore.current) return
    semaphore.current++

    setClient(null)
    setError(null)
    setLoading(true)
    setState(undefined)

    try {
      await client.signOut()
    } catch (err) {
      console.error('Failed to clear credentials', err)
      if (semaphore.current === 1) setError(String(err))
    } finally {
      if (semaphore.current === 1) setLoading(false)
      semaphore.current--
    }
  }, [semaphore, client])

  const signIn = useCallback(
    async (input: string, options?: OAuthAuthorizeOptions) => {
      if (client) return

      if (semaphore.current) return
      semaphore.current++

      setLoading(true)

      try {
        const client = await factory.signIn(input, options)
        setClient(client)
      } catch (err) {
        console.error('Failed to login', err)
        if (semaphore.current === 1) setError(String(err))
      } finally {
        if (semaphore.current === 1) setLoading(false)
        semaphore.current--
      }
    },
    [semaphore, client, factory],
  )

  return {
    clients,
    client: client ?? null,
    state,
    loading,
    error,
    signedIn: client != null,
    signIn,
    signOut,
  }
}

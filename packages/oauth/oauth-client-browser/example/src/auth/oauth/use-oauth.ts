'use client'

import {
  AuthorizeOptions,
  BrowserOAuthClient,
  BrowserOAuthClientLoadOptions,
  BrowserOAuthClientOptions,
  LoginContinuedInParentWindowError,
  OAuthAtpAgent,
} from '@atproto/oauth-client-browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type OnRestored = (agent: OAuthAtpAgent | null) => void
export type OnSignedIn = (agent: OAuthAtpAgent, state: null | string) => void
export type OnSignedOut = () => void
export type GetState = () =>
  | undefined
  | string
  | PromiseLike<undefined | string>

function useCallbackRef<T extends (this: any, ...args: any[]) => any>(
  fn: T,
): (this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>

function useCallbackRef<T extends (this: any, ...args: any[]) => any>(
  fn?: T,
): (this: ThisParameterType<T>, ...args: Parameters<T>) => void | ReturnType<T>

function useCallbackRef<T extends (this: any, ...args: any[]) => any>(fn?: T) {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])
  return useCallback(function (
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ): void | ReturnType<T> {
    const { current } = fnRef
    if (current) return current.call(this, ...args)
  }, [])
}

type ClientOptions =
  | { client: BrowserOAuthClient }
  | Pick<
      BrowserOAuthClientLoadOptions,
      | 'clientId'
      | 'handleResolver'
      | 'responseMode'
      | 'plcDirectoryUrl'
      | 'fetch'
    >
  | Pick<
      BrowserOAuthClientOptions,
      | 'clientMetadata'
      | 'handleResolver'
      | 'responseMode'
      | 'plcDirectoryUrl'
      | 'fetch'
    >

function useOAuthClient(options: ClientOptions): null | BrowserOAuthClient
function useOAuthClient(
  options: Partial<
    { client: BrowserOAuthClient } & BrowserOAuthClientLoadOptions &
      BrowserOAuthClientOptions
  >,
) {
  const {
    client: clientInput,
    clientId,
    clientMetadata,
    handleResolver,
    responseMode,
    plcDirectoryUrl,
  } = options

  const [client, setClient] = useState<null | BrowserOAuthClient>(
    clientInput || null,
  )
  const fetch = useCallbackRef(options.fetch || globalThis.fetch)

  useEffect(() => {
    if (clientInput) {
      setClient(clientInput)
    } else if (!handleResolver) {
      throw new TypeError('handleResolver is required')
    } else if (clientMetadata || !clientId) {
      const client = new BrowserOAuthClient({
        clientMetadata,
        handleResolver,
        responseMode,
        plcDirectoryUrl,
        fetch,
      })
      setClient(client)
      return () => client.dispose()
    } else {
      const ac = new AbortController()
      const { signal } = ac

      setClient(null)

      void BrowserOAuthClient.load({
        clientId,
        handleResolver,
        responseMode,
        plcDirectoryUrl,
        fetch,
        signal,
      }).then(
        (client) => {
          if (!signal.aborted) {
            signal.addEventListener('abort', () => client.dispose(), {
              once: true,
            })
            setClient(client)
          } else {
            client.dispose()
          }
        },
        (err) => {
          if (!signal.aborted) throw err
        },
      )

      return () => ac.abort()
    }
  }, [
    clientInput,
    clientId,
    clientMetadata,
    handleResolver,
    responseMode,
    plcDirectoryUrl,
    fetch,
  ])

  return client
}

export type UseOAuthOptions = ClientOptions & {
  onRestored?: OnRestored
  onSignedIn?: OnSignedIn
  onSignedOut?: OnSignedOut
  getState?: GetState
}

export function useOAuth(options: UseOAuthOptions) {
  const onRestored = useCallbackRef(options.onRestored)
  const onSignedIn = useCallbackRef(options.onSignedIn)
  const onSignedOut = useCallbackRef(options.onSignedOut)
  const getState = useCallbackRef(options.getState)

  const clientForInit = useOAuthClient(options)

  const [agent, setAgent] = useState<null | OAuthAtpAgent>(null)
  const [client, setClient] = useState<BrowserOAuthClient | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isLoginPopup, setIsLoginPopup] = useState(false)

  const clientForInitRef = useRef<typeof clientForInit>()
  useEffect(() => {
    // In strict mode, we don't want to re-init() the client if it's the same
    if (clientForInitRef.current === clientForInit) return
    clientForInitRef.current = clientForInit

    setAgent(null)
    setClient(null)
    setIsLoginPopup(false)
    setIsInitializing(clientForInit != null)

    clientForInit
      ?.init()
      .then(
        async (r) => {
          if (clientForInitRef.current !== clientForInit) return

          setClient(clientForInit)
          if (r) {
            setAgent(r.agent)

            if ('state' in r) {
              await onSignedIn(r.agent, r.state)
            } else {
              await onRestored(r.agent)
            }
          } else {
            await onRestored(null)
          }
        },
        async (err) => {
          if (clientForInitRef.current !== clientForInit) return
          if (err instanceof LoginContinuedInParentWindowError) {
            setIsLoginPopup(true)
            return
          }

          setClient(clientForInit)
          await onRestored(null)

          console.error('Failed to init:', err)
        },
      )
      .finally(() => {
        if (clientForInitRef.current !== clientForInit) return

        setIsInitializing(false)
      })
  }, [clientForInit, onSignedIn, onRestored])

  useEffect(() => {
    if (!client) return

    const controller = new AbortController()
    const { signal } = controller

    client.addEventListener(
      'updated',
      ({ detail: { sub } }) => {
        if (!agent || agent.did !== sub) {
          setAgent(null)
          client.restore(sub, false).then((agent) => {
            if (!signal.aborted) setAgent(agent)
          })
        }
      },
      { signal },
    )

    if (agent) {
      client.addEventListener(
        'deleted',
        ({ detail: { sub } }) => {
          if (agent.did === sub) {
            setAgent(null)
            void onSignedOut()
          }
        },
        { signal },
      )
    }

    void agent?.refreshIfNeeded()

    return () => {
      controller.abort()
    }
  }, [client, agent, onSignedOut])

  const signIn = useCallback(
    async (input: string, options?: AuthorizeOptions) => {
      if (!client) throw new Error('Client not initialized')

      const state = options?.state ?? (await getState()) ?? undefined
      const agent = await client.signIn(input, { ...options, state })
      setAgent(agent)
      await onSignedIn(agent, state ?? null)
      return agent
    },
    [client, getState, onSignedIn],
  )

  // Memoize the return value to avoid re-renders in consumers
  return useMemo(
    () => ({
      isInitializing,
      isInitialized: client != null,
      isLoginPopup,

      signIn,

      client,
      agent,
    }),
    [isInitializing, isLoginPopup, agent, client, signIn],
  )
}

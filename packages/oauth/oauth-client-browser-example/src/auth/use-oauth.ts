'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AuthorizeOptions,
  BrowserOAuthClient,
  BrowserOAuthClientLoadOptions,
  BrowserOAuthClientOptions,
  LoginContinuedInParentWindowError,
  OAuthSession,
} from '@atproto/oauth-client-browser'

type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export type OnRestored = (session: OAuthSession | null) => void
export type OnSignedIn = (session: OAuthSession, state: null | string) => void
export type OnSignedOut = () => void

export type OAuthSignIn = (
  input: string,
  options?: AuthorizeOptions,
) => Promise<void>

function useValueRef<T>(value: T) {
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])
  return valueRef
}

function useCallbackRef<T extends (this: any, ...args: any[]) => any>(
  fn: T,
): (this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>

function useCallbackRef<T extends (this: any, ...args: any[]) => any>(
  fn?: T,
): (this: ThisParameterType<T>, ...args: Parameters<T>) => void | ReturnType<T>

function useCallbackRef<T extends (this: any, ...args: any[]) => any>(fn?: T) {
  const fnRef = useValueRef(fn)
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
  | Simplify<
      Pick<
        BrowserOAuthClientLoadOptions,
        | 'clientId'
        | 'handleResolver'
        | 'responseMode'
        | 'plcDirectoryUrl'
        | 'fetch'
        | 'allowHttp'
      >
    >
  | Simplify<
      Pick<
        BrowserOAuthClientOptions,
        | 'clientMetadata'
        | 'handleResolver'
        | 'responseMode'
        | 'plcDirectoryUrl'
        | 'fetch'
        | 'allowHttp'
      >
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
    clientMetadata,
    clientId = clientMetadata?.client_id,
    handleResolver,
    responseMode,
    plcDirectoryUrl,
    allowHttp,
  } = options

  // Input sanity checks
  if (!clientInput && !handleResolver) {
    throw new TypeError('handleResolver is required in ClientOptions.')
  } else if (
    clientId &&
    clientMetadata &&
    clientId !== clientMetadata.client_id
  ) {
    throw new TypeError('clientId and clientMetadata.client_id do not match.')
  } else if (
    clientId &&
    clientInput &&
    clientInput.clientMetadata.client_id !== clientId
  ) {
    throw new TypeError('client and clientId do not match.')
  }

  const [client, setClient] = useState<null | BrowserOAuthClient>(
    clientInput || null,
  )
  const fetch = useCallbackRef(options.fetch || globalThis.fetch)

  useEffect(() => {
    const ac = new AbortController()
    const { signal } = ac

    if (clientInput) {
      setClient(clientInput)
    } else if (clientMetadata) {
      const client = new BrowserOAuthClient({
        clientMetadata,
        handleResolver,
        responseMode,
        plcDirectoryUrl,
        fetch,
        allowHttp,
      })

      setClient(client)

      signal.addEventListener('abort', () => client.dispose(), { once: true })
    } else if (clientId) {
      setClient(null)

      const loadClientForever = async (): Promise<BrowserOAuthClient> => {
        for (let failureCount = 0; ; failureCount++) {
          try {
            signal.throwIfAborted()

            console.info('Loading OAuth client metadata:', clientId)

            return await BrowserOAuthClient.load({
              clientId,
              handleResolver,
              responseMode,
              plcDirectoryUrl,
              fetch,
              allowHttp,
              signal,
            })
          } catch (err) {
            const backoff = Math.min(5e3, 2 ** failureCount * 100)
            console.error(
              `Failed to load client (failures: ${failureCount}, retrying in ${backoff}ms):`,
              err,
            )
            await new Promise((res) => setTimeout(res, backoff))
            if (signal.aborted) throw err
          }
        }
      }

      void loadClientForever().then((client) => {
        if (signal.aborted) {
          client.dispose()
        } else {
          setClient(client)
          signal.addEventListener('abort', () => client.dispose(), {
            once: true,
          })
        }
      })
    } else {
      setClient(null)
    }

    return () => ac.abort()
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

  state?: string
  scope?: string

  refreshOnInit?: boolean
}

export function useOAuth(options: UseOAuthOptions) {
  const onRestored = useCallbackRef(options.onRestored)
  const onSignedIn = useCallbackRef(options.onSignedIn)
  const onSignedOut = useCallbackRef(options.onSignedOut)

  const clientForInit = useOAuthClient(options)

  const scopeRef = useValueRef(options.scope)
  const stateRef = useValueRef(options.state)

  const [session, setSession] = useState<null | OAuthSession>(null)
  const [client, setClient] = useState<BrowserOAuthClient | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isLoginPopup, setIsLoginPopup] = useState(false)

  const clientForInitRef = useRef<typeof clientForInit>(null)
  useEffect(() => {
    // In strict mode, we don't want to re-init() the client if it's the same
    if (clientForInitRef.current === clientForInit) return
    clientForInitRef.current = clientForInit

    setSession(null)
    setClient(null)
    setIsLoginPopup(false)
    setIsInitializing(clientForInit != null)

    void clientForInit
      ?.init(options.refreshOnInit)
      .then(
        async (r) => {
          if (clientForInitRef.current !== clientForInit) return

          setClient(clientForInit)
          if (r) {
            setSession(r.session)

            if (r.state !== undefined) {
              await onSignedIn(r.session, r.state)
            } else {
              await onRestored(r.session)
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
        if (!session || session.sub !== sub) {
          setSession(null)
          client.restore(sub, false).then((session) => {
            if (!signal.aborted) setSession(session)
          })
        }
      },
      { signal },
    )

    if (session) {
      client.addEventListener(
        'deleted',
        ({ detail: { sub } }) => {
          if (session.sub === sub) {
            console.debug('Session was deleted, signing out', { sub })

            setSession(null)
            void onSignedOut()
          }
        },
        { signal },
      )
    }

    return () => {
      controller.abort()
    }
  }, [client, session, onSignedOut])

  const signIn = useCallback<OAuthSignIn>(
    async (input, options) => {
      if (!client) throw new Error('Client not initialized')
      const state = stateRef.current
      const scope = scopeRef.current
      const session = await client.signIn(input, { scope, state, ...options })
      setSession(session)
      await onSignedIn(session, state ?? null)
    },
    [client, onSignedIn],
  )

  return {
    isInitializing,
    isInitialized: client != null,
    isLoginPopup,

    signIn,

    client,
    session,
  }
}

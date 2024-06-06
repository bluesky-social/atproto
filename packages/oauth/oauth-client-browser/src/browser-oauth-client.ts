import { HandleResolver } from '@atproto-labs/handle-resolver'
import {
  AuthorizeOptions,
  OAuthAgent,
  OAuthCallbackError,
  OAuthClient,
  Session,
  SessionStore,
} from '@atproto/oauth-client'
import {
  OAuthClientMetadataInput,
  OAuthResponseMode,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'

import {
  BrowserOAuthDatabase,
  DatabaseStore,
} from './browser-oauth-database.js'
import { CryptoSubtle } from './crypto-subtle.js'
import { LoginContinuedInParentWindowError } from './errors.js'

export type BrowserOAuthClientOptions = {
  clientMetadata?: OAuthClientMetadataInput | string | URL
  handleResolver?: HandleResolver | string | URL
  responseMode?: OAuthResponseMode
  plcDirectoryUrl?: string | URL
  fetch?: typeof globalThis.fetch
  crypto?: Crypto
}

export interface SessionListener {
  (event: 'updated', sessionId: string, session: Session): void
  (event: 'revoked', sessionId: string): void
  (event: 'deleted', sessionId: string): void
}

const NAMESPACE = `@@atproto/oauth-client-browser`

const POPUP_CHANNEL_NAME = `${NAMESPACE}(popup-channel)`
const POPUP_STATE_PREFIX = `${NAMESPACE}(popup-state):`

const REVOKE_CHANNEL_NAME = `${NAMESPACE}(revoke-channel)`

type ChannelResultData = {
  key: string
  result:
    | PromiseRejectedResult
    | PromiseFulfilledResult<{
        sessionId: string
      }>
}

type ChannelAckData = {
  key: string
  ack: true
}

type ChannelData = ChannelResultData | ChannelAckData

const revokeChannel = new BroadcastChannel(REVOKE_CHANNEL_NAME)

const wrapSessionStore = (
  dbStore: DatabaseStore<Session>,
  listeners: readonly SessionListener[],
): Required<SessionStore & DatabaseStore<Session>> => {
  const onMessage = (event: MessageEvent<{ sessionId: string }>) => {
    if (event.source !== window) {
      // If the message was posted from the current window, the "delete" event
      // will already have been triggered.
      for (const listener of listeners) {
        listener('revoked', event.data.sessionId)
      }
    }
  }

  revokeChannel.addEventListener('message', onMessage)

  return {
    getKeys: async () => {
      return dbStore.getKeys()
    },
    get: async (sessionId) => {
      return dbStore.get(sessionId)
    },
    set: async (sessionId, session) => {
      await dbStore.set(sessionId, session)
      for (const listener of listeners) {
        listener('updated', sessionId, session)
      }
    },
    del: async (sessionId) => {
      await dbStore.del(sessionId)
      revokeChannel.postMessage({ sessionId })

      for (const listener of listeners) {
        listener('deleted', sessionId)
      }
    },
    revoked: (sessionId) => {
      for (const listener of listeners) {
        listener('revoked', sessionId)
      }
    },
    clear: async () => {
      await dbStore.clear?.()
    },
  }
}

export class BrowserOAuthClient extends OAuthClient {
  static async load(
    options: Omit<BrowserOAuthClientOptions, 'clientMetadata'>,
  ) {
    const fetch = options?.fetch ?? globalThis.fetch
    const request = new Request('/.well-known/oauth-client-metadata', {
      redirect: 'error',
    })
    const response = await fetch(request)
    if (!response.ok) throw new TypeError('Failed to fetch client metadata')

    const json: unknown = await response.json()

    return new BrowserOAuthClient({
      clientMetadata: oauthClientMetadataSchema.parse(json),
      ...options,
    })
  }

  readonly sessionStore: DatabaseStore<Session>

  private readonly listeners: SessionListener[]
  private readonly database: BrowserOAuthDatabase

  constructor({
    clientMetadata = window.location.href,
    handleResolver = 'https://bsky.social',
    // "fragment" is safer as it is not sent to the server
    responseMode = 'fragment',
    plcDirectoryUrl = 'https://plc.directory',
    crypto = globalThis.crypto,
    fetch = globalThis.fetch,
  }: BrowserOAuthClientOptions = {}) {
    const database = new BrowserOAuthDatabase()

    const listeners = []
    const sessionStore = wrapSessionStore(database.getSessionStore(), listeners)

    super({
      clientMetadata:
        typeof clientMetadata === 'string' || clientMetadata instanceof URL
          ? {
              client_id: 'http://localhost/',
              redirect_uris: [
                new URL(clientMetadata).href.replace('localhost', '127.0.0.1'),
              ],
              // If the server supports then, let's also ask for an ID token
              response_types: ['code id_token', 'code'],
            }
          : clientMetadata,

      responseMode,
      fetch,
      cryptoImplementation: new CryptoSubtle(crypto),
      plcDirectoryUrl,
      handleResolver,
      sessionStore,
      stateStore: database.getStateStore(),

      didCache: database.getDidCache(),
      handleCache: database.getHandleCache(),
      dpopNonceCache: database.getDpopNonceCache(),
      authorizationServerMetadataCache:
        database.getAuthorizationServerMetadataCache(),
      protectedResourceMetadataCache:
        database.getProtectedResourceMetadataCache(),
    })

    this.sessionStore = sessionStore

    this.listeners = listeners
    this.database = database

    fixLocation(this.clientMetadata)
  }

  onSession(listener: SessionListener) {
    this.listeners.push(listener)
    let called = false
    return () => {
      if (called) return
      called = true

      const index = this.listeners.indexOf(listener)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  async restoreAll() {
    const sessionIds = await this.sessionStore.getKeys()
    return Object.fromEntries(
      await Promise.all(
        sessionIds.map(async (sessionId) => {
          return [sessionId, await this.restore(sessionId, false)] as const
        }),
      ),
    )
  }

  async init(sessionId?: string, refresh?: boolean) {
    const signInResult = await this.signInCallback()
    if (signInResult) {
      return signInResult
    } else if (sessionId) {
      const agent = await this.restore(sessionId, refresh)
      return { agent }
    } else {
      // @TODO: we could restore any session from the store ?
    }
  }

  async signIn(
    input: string,
    options?: AuthorizeOptions & { signal?: AbortSignal },
  ) {
    if (options?.display === 'popup') {
      return this.signInPopup(input, options)
    } else {
      return this.signInRedirect(input, options)
    }
  }

  async signInRedirect(input: string, options?: AuthorizeOptions) {
    const url = await this.authorize(input, options)

    window.location.href = url.href

    // back-forward cache
    return new Promise<never>((resolve, reject) => {
      setTimeout(() => reject(new Error('User navigated back')), 5e3)
    })
  }

  async signInPopup(
    input: string,
    options?: Omit<AuthorizeOptions, 'state'> & { signal?: AbortSignal },
  ): Promise<OAuthAgent> {
    // Open new window asap to prevent popup busting by browsers
    const popupFeatures = 'width=600,height=600,menubar=no,toolbar=no'
    let popup: Window | null = window.open(
      'about:blank',
      '_blank',
      popupFeatures,
    )

    const stateKey = `${Math.random().toString(36).slice(2)}`

    const url = await this.authorize(input, {
      ...options,
      state: `${POPUP_STATE_PREFIX}${stateKey}`,
      display: options?.display ?? 'popup',
    })

    options?.signal?.throwIfAborted()

    if (popup) {
      popup.window.location.href = url.href
    } else {
      popup = window.open(url.href, '_blank', popupFeatures)
    }

    popup?.focus()

    return new Promise<OAuthAgent>((resolve, reject) => {
      const channel = new BroadcastChannel(POPUP_CHANNEL_NAME)

      const cleanup = () => {
        clearTimeout(timeout)
        channel.removeEventListener('message', onMessage)
        channel.close()
        options?.signal?.removeEventListener('abort', cancel)
        popup?.close()
      }

      const cancel = () => {
        // @TODO: Store fact that the request was cancelled, allowing any
        // callback (e.g. in the popup) to revoke the session or credentials.

        reject(new Error(options?.signal?.aborted ? 'Aborted' : 'Timeout'))
        cleanup()
      }

      options?.signal?.addEventListener('abort', cancel)

      const timeout = setTimeout(cancel, 5 * 60e3)

      const onMessage = async ({ data }: MessageEvent<ChannelData>) => {
        if (data.key !== stateKey) return
        if (!('result' in data)) return

        // Send acknowledgment to popup window
        channel.postMessage({ key: stateKey, ack: true })

        cleanup()

        const { result } = data
        if (result.status === 'fulfilled') {
          const { sessionId } = result.value
          try {
            options?.signal?.throwIfAborted()
            resolve(await this.restore(sessionId))
          } catch (err) {
            reject(err)
            void this.revoke(sessionId)
          }
        } else {
          const { message, params } = result.reason
          reject(new OAuthCallbackError(new URLSearchParams(params), message))
        }
      }

      channel.addEventListener('message', onMessage)
    })
  }

  private readCallbackParams(): URLSearchParams | null {
    const params =
      this.responseMode === 'fragment'
        ? new URLSearchParams(location.hash.slice(1))
        : new URLSearchParams(location.search)

    // Only if the current URL contains a valid oauth response params
    if (!params.has('state') || !(params.has('code') || params.has('error'))) {
      return null
    }

    const machesLocation = (url: URL) =>
      location.origin === url.origin && location.pathname === url.pathname
    const redirectUrls = this.clientMetadata.redirect_uris.map(
      (uri) => new URL(uri),
    )

    // Only if the current URL is one of the redirect_uris
    if (!redirectUrls.some(machesLocation)) return null

    return params
  }

  async signInCallback() {
    const params = this.readCallbackParams()

    // Not a (valid) OAuth redirect
    if (!params) return null

    // Replace the current history entry without the params (this will prevent
    // the following code to run again if the user refreshes the page)
    history.replaceState(null, '', location.pathname)

    const sendResult = (message: ChannelResultData) => {
      const channel = new BroadcastChannel(POPUP_CHANNEL_NAME)

      return new Promise<boolean>((resolve) => {
        const cleanup = (result: boolean) => {
          clearTimeout(timer)
          channel.removeEventListener('message', onMessage)
          channel.close()
          resolve(result)
        }

        const onTimeout = () => {
          cleanup(false)
        }

        const onMessage = ({ data }: MessageEvent<ChannelData>) => {
          if (message.key !== data.key || !('ack' in data)) return

          cleanup(true)
        }

        channel.addEventListener('message', onMessage)
        channel.postMessage(message)
        // Receiving of "ack" should be very fast, giving it 500 ms anyway
        const timer = setTimeout(onTimeout, 500)
      })
    }

    return this.callback(params)
      .then(async (result) => {
        if (result.state?.startsWith(POPUP_STATE_PREFIX)) {
          const receivedByParent = await sendResult({
            key: result.state.slice(POPUP_STATE_PREFIX.length),
            result: {
              status: 'fulfilled',
              value: {
                sessionId: result.agent.sessionId,
              },
            },
          })

          // Revoke the credentials if the parent window was closed
          if (!receivedByParent) await result.agent.signOut()

          throw new LoginContinuedInParentWindowError() // signInPopup
        }

        return result
      })
      .catch(async (err) => {
        if (
          err instanceof OAuthCallbackError &&
          err.state?.startsWith(POPUP_STATE_PREFIX)
        ) {
          await sendResult({
            key: err.state.slice(POPUP_STATE_PREFIX.length),
            result: {
              status: 'rejected',
              reason: {
                message: err.message,
                params: Array.from(err.params.entries()),
              },
            },
          })

          throw new LoginContinuedInParentWindowError() // signInPopup
        }

        // Most probable cause at this point is that the "state" parameter is
        // invalid.
        throw err
      })
      .catch((err) => {
        if (err instanceof LoginContinuedInParentWindowError) {
          // parent will also try to close the popup
          window.close()
        }

        throw err
      })
  }

  async [Symbol.asyncDispose]() {
    await this.database[Symbol.asyncDispose]()
  }
}

/**
 * Since "localhost" is often used either in IP mode or in hostname mode,
 * and because the redirect uris must use the IP mode, we need to make sure
 * that the current location url is not using "localhost".
 *
 * This is required for the IndexedDB to work properly. Indeed, the IndexedDB
 * is shared by origin, so we must ensure to be on the same origin as the
 * redirect uris.
 */
function fixLocation(clientMetadata: OAuthClientMetadataInput) {
  if (clientMetadata.client_id !== 'http://localhost/') return
  if (window.location.hostname !== 'localhost') return

  const locationUrl = new URL(window.location.href)

  for (const uri of clientMetadata.redirect_uris) {
    const url = new URL(uri)
    if (
      url.port === locationUrl.port &&
      url.protocol === locationUrl.protocol &&
      (url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    ) {
      window.location.hostname = url.hostname

      // Prevent APP from loading on the wrong hostname
      throw new Error('Redirecting to loopback IP...')
    }
  }

  throw new Error(
    `Please use the loopback IP address instead of ${locationUrl}`,
  )
}

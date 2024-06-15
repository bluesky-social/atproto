import { HandleResolver } from '@atproto-labs/handle-resolver'
import {
  AuthorizeOptions,
  OAuthAgent,
  OAuthCallbackError,
  OAuthClient,
  Session,
  TokenSet,
} from '@atproto/oauth-client'
import {
  OAuthClientId,
  OAuthClientMetadataInput,
  OAuthResponseMode,
  atprotoLoopbackClientMetadata,
  isOAuthClientIdDiscoverable,
  isOAuthClientIdLoopback,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'

import {
  BrowserOAuthDatabase,
  DatabaseStore,
} from './browser-oauth-database.js'
import { BrowserRuntimeImplementation } from './browser-runtime-implementation.js'
import { LoginContinuedInParentWindowError } from './errors.js'
import { buildLoopbackClientId } from './util.js'

export type BrowserOAuthClientOptions = {
  clientMetadata?: OAuthClientMetadataInput
  handleResolver?: HandleResolver | string | URL
  responseMode?: OAuthResponseMode
  plcDirectoryUrl?: string | URL

  crypto?: typeof globalThis.crypto
  fetch?: typeof globalThis.fetch
}

type EventDetails = {
  updated: TokenSet
  deleted: { sub: string }
}

type CustomEventListener<T extends keyof EventDetails = keyof EventDetails> = (
  event: CustomEvent<EventDetails[T]>,
) => void

const initEvent = <T extends keyof EventDetails>(
  type: T,
  detail: EventDetails[T],
) => new CustomEvent(type, { detail, cancelable: false, bubbles: false })

const NAMESPACE = `@@atproto/oauth-client-browser`

//- Popup channel

const POPUP_CHANNEL_NAME = `${NAMESPACE}(popup-channel)`
const POPUP_STATE_PREFIX = `${NAMESPACE}(popup-state):`

type PopupChannelResultData = {
  key: string
  result: PromiseRejectedResult | PromiseFulfilledResult<string>
}

type PopupChannelAckData = {
  key: string
  ack: true
}

type PopupChannelData = PopupChannelResultData | PopupChannelAckData

//- Deleted channel

const deletedChannel = new BroadcastChannel(`${NAMESPACE}(deleted-channel)`)

type WrappedSessionStore = Disposable & DatabaseStore<Session>
const wrapSessionStore = (
  dbStore: DatabaseStore<Session>,
  eventTarget: EventTarget,
) => {
  const store: WrappedSessionStore = {
    getKeys: async () => {
      return dbStore.getKeys()
    },
    get: async (sub) => {
      return dbStore.get(sub)
    },
    set: async (sub, session) => {
      await dbStore.set(sub, session)

      eventTarget.dispatchEvent(initEvent('updated', session.tokenSet))
    },
    del: async (sub) => {
      await dbStore.del(sub)
      deletedChannel.postMessage(sub)

      eventTarget.dispatchEvent(initEvent('deleted', { sub }))
    },
    clear: async () => {
      await dbStore.clear?.()
    },
    [Symbol.dispose]: () => {
      deletedChannel.removeEventListener('message', onMessage)
    },
  }

  const onMessage = (event: MessageEvent<string>) => {
    // Listen for "deleted" events from other windows. The content will already
    // have been deleted from the store so we only need to notify the listeners.
    if (event.source !== window) {
      const sub = event.data
      eventTarget.dispatchEvent(initEvent('deleted', { sub }))
    }
  }

  deletedChannel.addEventListener('message', onMessage)

  return store
}

export type BrowserOAuthClientLoadOptions = Omit<
  BrowserOAuthClientOptions,
  'clientMetadata'
> & {
  clientId: OAuthClientId
  signal?: AbortSignal
}

export class BrowserOAuthClient extends OAuthClient {
  static async load({ clientId, ...options }: BrowserOAuthClientLoadOptions) {
    if (isOAuthClientIdLoopback(clientId)) {
      return new BrowserOAuthClient({
        clientMetadata: atprotoLoopbackClientMetadata(clientId),
        ...options,
      })
    } else if (isOAuthClientIdDiscoverable(clientId)) {
      const fetch = options?.fetch ?? globalThis.fetch
      const request = new Request(clientId, {
        redirect: 'error',
        signal: options.signal,
      })
      const response = await fetch(request)

      if (response.status !== 200) {
        throw new TypeError(
          `Failed to fetch client metadata: ${response.status}`,
        )
      }

      const mime = response.headers.get('content-type')?.split(';')[0].trim()
      if (mime !== 'application/json') {
        throw new TypeError(`Invalid content type: ${mime}`)
      }

      const json: unknown = await response.json()

      options.signal?.throwIfAborted()

      return new BrowserOAuthClient({
        clientMetadata: oauthClientMetadataSchema.parse(json),
        ...options,
      })
    } else {
      throw new TypeError(`Invalid client id: ${clientId}`)
    }
  }

  readonly sessionStore: WrappedSessionStore

  private readonly eventTarget: EventTarget
  private readonly database: BrowserOAuthDatabase

  constructor({
    clientMetadata,
    handleResolver = 'https://bsky.social',
    // "fragment" is safer as it is not sent to the server
    responseMode = 'fragment',
    plcDirectoryUrl = 'https://plc.directory',
    crypto = globalThis.crypto,
    fetch = globalThis.fetch,
  }: BrowserOAuthClientOptions = {}) {
    const database = new BrowserOAuthDatabase()

    const eventTarget = new EventTarget()
    const sessionStore = wrapSessionStore(
      database.getSessionStore(),
      eventTarget,
    )

    super({
      clientMetadata:
        clientMetadata == null
          ? atprotoLoopbackClientMetadata(
              buildLoopbackClientId(window.location),
            )
          : clientMetadata,
      responseMode,
      fetch,
      runtimeImplementation: new BrowserRuntimeImplementation(crypto),
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

    this.eventTarget = eventTarget
    this.database = database

    fixLocation(this.clientMetadata)
  }

  addEventListener<T extends keyof EventDetails>(
    type: T,
    callback: CustomEventListener<T> | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    this.eventTarget.addEventListener(type, callback as EventListener, options)
  }

  removeEventListener(
    type: string,
    callback: CustomEventListener | null,
    options?: EventListenerOptions | boolean,
  ) {
    this.eventTarget.removeEventListener(
      type,
      callback as EventListener,
      options,
    )
  }

  async restoreAll() {
    const subs = await this.sessionStore.getKeys()
    return Object.fromEntries(
      await Promise.all(
        subs.map(async (sub) => [sub, await this.restore(sub, false)] as const),
      ),
    )
  }

  async init(sub?: string, refresh?: boolean) {
    const signInResult = await this.signInCallback()
    if (signInResult) {
      return signInResult
    } else if (sub) {
      const agent = await this.restore(sub, refresh)
      return { agent }
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
      const popupChannel = new BroadcastChannel(POPUP_CHANNEL_NAME)

      const cleanup = () => {
        clearTimeout(timeout)
        popupChannel.removeEventListener('message', onMessage)
        popupChannel.close()
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

      const onMessage = async ({ data }: MessageEvent<PopupChannelData>) => {
        if (data.key !== stateKey) return
        if (!('result' in data)) return

        // Send acknowledgment to popup window
        popupChannel.postMessage({ key: stateKey, ack: true })

        cleanup()

        const { result } = data
        if (result.status === 'fulfilled') {
          const sub = result.value
          try {
            options?.signal?.throwIfAborted()
            resolve(await this.restore(sub))
          } catch (err) {
            reject(err)
            void this.revoke(sub)
          }
        } else {
          const { message, params } = result.reason
          reject(new OAuthCallbackError(new URLSearchParams(params), message))
        }
      }

      popupChannel.addEventListener('message', onMessage)
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

    const matchesLocation = (url: URL) =>
      location.origin === url.origin && location.pathname === url.pathname
    const redirectUrls = this.clientMetadata.redirect_uris.map(
      (uri) => new URL(uri),
    )

    // Only if the current URL is one of the redirect_uris
    if (!redirectUrls.some(matchesLocation)) return null

    return params
  }

  async signInCallback() {
    const params = this.readCallbackParams()

    // Not a (valid) OAuth redirect
    if (!params) return null

    // Replace the current history entry without the params (this will prevent
    // the following code to run again if the user refreshes the page)
    history.replaceState(null, '', location.pathname)

    const sendResult = (message: PopupChannelResultData) => {
      const popupChannel = new BroadcastChannel(POPUP_CHANNEL_NAME)

      return new Promise<boolean>((resolve) => {
        const cleanup = (result: boolean) => {
          clearTimeout(timer)
          popupChannel.removeEventListener('message', onMessage)
          popupChannel.close()
          resolve(result)
        }

        const onTimeout = () => {
          cleanup(false)
        }

        const onMessage = ({ data }: MessageEvent<PopupChannelData>) => {
          if ('ack' in data && message.key === data.key) cleanup(true)
        }

        popupChannel.addEventListener('message', onMessage)
        popupChannel.postMessage(message)
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
              value: result.agent.sub,
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
    // TODO This should be implemented using a DisposableStack
    await this.sessionStore[Symbol.dispose]()
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

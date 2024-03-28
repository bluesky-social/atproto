import { Fetch } from '@atproto/fetch'
import { UniversalIdentityResolver } from '@atproto/identity-resolver'
import {
  OAuthAuthorizeOptions,
  OAuthClient,
  OAuthClientFactory,
  OAuthResponseMode,
  OAuthResponseType,
  Session,
} from '@atproto/oauth-client'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'
import IsomorphicOAuthServerMetadataResolver from '@atproto/oauth-server-metadata-resolver'
import {
  BrowserOAuthDatabase,
  DatabaseStore,
  PopupStateData,
} from './browser-oauth-database.js'
import { CryptoSubtle } from './crypto-subtle.js'

export type BrowserOauthClientFactoryOptions = {
  responseMode?: OAuthResponseMode
  responseType?: OAuthResponseType
  clientMetadata: OAuthClientMetadata
  fetch?: Fetch
  crypto?: Crypto
}

const POPUP_KEY_PREFIX = '@@oauth-popup-callback:'

export class BrowserOAuthClientFactory extends OAuthClientFactory {
  readonly popupStore: DatabaseStore<PopupStateData>
  readonly sessionStore: DatabaseStore<Session>

  private database: BrowserOAuthDatabase

  constructor({
    clientMetadata,
    // "fragment" is safer as it is not sent to the server
    responseMode = 'fragment',
    responseType,
    crypto = globalThis.crypto,
    fetch = globalThis.fetch,
  }: BrowserOauthClientFactoryOptions) {
    const database = new BrowserOAuthDatabase()

    super({
      clientMetadata,
      responseMode,
      responseType,
      fetch,
      cryptoImplementation: new CryptoSubtle(crypto),
      sessionStore: database.getSessionStore(),
      stateStore: database.getStateStore(),
      metadataResolver: new IsomorphicOAuthServerMetadataResolver({
        fetch,
        cache: database.getMetadataCache(),
      }),
      identityResolver: UniversalIdentityResolver.from({
        fetch,
        didCache: database.getDidCache(),
        handleCache: database.getHandleCache(),
      }),
      dpopNonceCache: database.getDpopNonceCache(),
    })

    this.sessionStore = database.getSessionStore()
    this.popupStore = database.getPopupStore()

    this.database = database
  }

  async restoreAll() {
    const sessionIds = await this.sessionStore.getKeys()
    return Object.fromEntries(
      await Promise.all(
        sessionIds.map(
          async (sessionId) =>
            [sessionId, await this.restore(sessionId, false)] as const,
        ),
      ),
    )
  }

  async init(sessionId?: string, forceRefresh = false) {
    const signInResult = await this.signInCallback()
    if (signInResult) {
      return signInResult
    } else if (sessionId) {
      const client = await this.restore(sessionId, forceRefresh)
      return { client }
    } else {
      // TODO: we could restore any session from the store ?
    }
  }

  async signIn(input: string, options?: OAuthAuthorizeOptions) {
    if (options?.display === 'popup') {
      return this.signInPopup(input, options)
    } else {
      return this.signInRedirect(input, options)
    }
  }

  async signInRedirect(input: string, options?: OAuthAuthorizeOptions) {
    const url = await this.authorize(input, options)

    window.location.href = url.href

    // back-forward cache
    return new Promise<never>((resolve, reject) => {
      setTimeout(() => reject(new Error('User navigated back')), 5e3)
    })
  }

  async signInPopup(
    input: string,
    options?: Omit<OAuthAuthorizeOptions, 'state'> & {
      signal?: AbortSignal
    },
  ): Promise<OAuthClient> {
    // Open new window asap to prevent popup busting by browsers
    // TODO: If this doesn't work, maybe try opening the windows with
    // `${redirect_uris[0]}#placeholder` ?
    let popup = window.open('about:blank', '_blank', 'width=600,height=600')

    const stateKey = `${Math.random().toString(36).slice(2)}`

    const url = await this.authorize(input, {
      ...options,
      state: `${POPUP_KEY_PREFIX}${stateKey}`,
      display: options?.display ?? 'popup',
    })

    try {
      options?.signal?.throwIfAborted()

      if (popup) {
        popup.window.location.href = url.href
      } else {
        popup = window.open(url.href, '_blank', 'width=600,height=600')
      }

      return await new Promise<OAuthClient>((resolve, reject) => {
        const cleanup = () => {
          clearInterval(interval)
          clearTimeout(timeout)
          void this.popupStore.del(stateKey)
          options?.signal?.removeEventListener('abort', cancel)
        }

        const cancel = () => {
          // TODO: Store fact that the request was cancelled, allowing any
          // callback to not request credentials (or revoke those obtained)

          reject(new Error(options?.signal?.aborted ? 'Aborted' : 'Timeout'))
          cleanup()
        }

        options?.signal?.addEventListener('abort', cancel)

        const timeout = setTimeout(cancel, 5 * 60e3)

        const interval = setInterval(async () => {
          const result = await this.popupStore.get(stateKey)
          if (!result) return

          cleanup()

          if (result.status === 'fulfilled') {
            const sessionId = result.value
            try {
              options?.signal?.throwIfAborted()
              resolve(await this.restore(sessionId, true))
            } catch (err) {
              reject(err)
              void this.revoke(sessionId)
            }
          } else {
            // TODO: Re-build a proper error object (from the same class
            // that was used to throw the error)
            reject(new Error(result.reason))
          }
        }, 500)
      })
    } finally {
      popup?.close()
    }
  }

  async signInCallback() {
    const redirectUri = new URL(this.clientMetadata.redirect_uris[0])
    if (location.pathname !== redirectUri.pathname) return null

    const params =
      this.responseMode === 'query'
        ? new URLSearchParams(location.search)
        : new URLSearchParams(location.hash.slice(1))

    // Only if the query string contains oauth callback params
    if (
      !params.has('iss') ||
      !params.has('state') ||
      !(params.has('code') || params.has('error'))
    ) {
      return null
    }

    // Replace the current history entry without the query string (this will
    // prevent this 'if' branch to run again if the user refreshes the page)
    history.replaceState(null, '', location.pathname)

    return this.callback(params)
      .then(async (result) => {
        if (result.state?.startsWith(POPUP_KEY_PREFIX)) {
          const stateKey = result.state.slice(POPUP_KEY_PREFIX.length)

          await this.popupStore.set(stateKey, {
            status: 'fulfilled',
            value: result.client.sessionId,
          })

          window.close() // continued in signInPopup
          throw new Error('Login complete, please close the popup window.')
        }

        return result
      })
      .catch(async (err) => {
        // TODO: Throw a proper error from parent class to actually detect
        // oauth authorization errors
        const state = typeof (err as any)?.state
        if (typeof state === 'string' && state?.startsWith(POPUP_KEY_PREFIX)) {
          const stateKey = state.slice(POPUP_KEY_PREFIX.length)

          await this.popupStore.set(stateKey, {
            status: 'rejected',
            reason: err,
          })

          window.close() // continued in signInPopup
          throw new Error('Login complete, please close the popup window.')
        }

        throw err
      })
  }

  async [Symbol.asyncDispose]() {
    await this.database[Symbol.asyncDispose]()
  }
}

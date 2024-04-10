import { Fetch } from '@atproto/fetch'
import {
  UniversalIdentityResolver,
  UniversalIdentityResolverOptions,
} from '@atproto/identity-resolver'
import {
  OAuthAuthorizeOptions,
  OAuthClient,
  OAuthClientFactory,
  OAuthCallbackError,
  OAuthResponseMode,
  OAuthResponseType,
  Session,
} from '@atproto/oauth-client'
import {
  OAuthClientMetadata,
  oauthClientMetadataSchema,
} from '@atproto/oauth-client-metadata'
import IsomorphicOAuthServerMetadataResolver from '@atproto/oauth-server-metadata-resolver'
import {
  BrowserOAuthDatabase,
  DatabaseStore,
  PopupStateData,
} from './browser-oauth-database'
import { CryptoSubtle } from './crypto-subtle'
import { LoginContinuedInParentWindowError } from './errors'

export type BrowserOauthClientFactoryOptions = {
  responseMode?: OAuthResponseMode
  responseType?: OAuthResponseType
  clientMetadata: OAuthClientMetadata
  plcDirectoryUrl?: UniversalIdentityResolverOptions['plcDirectoryUrl']
  atprotoLexiconUrl?: UniversalIdentityResolverOptions['atprotoLexiconUrl']
  fetch?: Fetch
  crypto?: Crypto
}

const POPUP_STATE_PREFIX = '@@oauth-popup-callback:'

export class BrowserOAuthClientFactory extends OAuthClientFactory {
  static async load(
    options?: Omit<BrowserOauthClientFactoryOptions, 'clientMetadata'>,
  ) {
    const fetch = options?.fetch ?? globalThis.fetch
    const request = new Request('/.well-known/oauth-client-metadata', {
      redirect: 'error',
    })
    const response = await fetch(request)
    const clientMetadata = oauthClientMetadataSchema.parse(
      await response.json(),
    )
    return new BrowserOAuthClientFactory({ clientMetadata, ...options })
  }

  readonly popupStore: DatabaseStore<PopupStateData>
  readonly sessionStore: DatabaseStore<Session>

  private database: BrowserOAuthDatabase

  constructor({
    clientMetadata,
    // "fragment" is safer as it is not sent to the server
    responseMode = 'fragment',
    responseType,
    plcDirectoryUrl,
    atprotoLexiconUrl,
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
        plcDirectoryUrl,
        atprotoLexiconUrl,
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
      const client = await this.restore(sessionId, refresh)
      return { client }
    } else {
      // TODO: we could restore any session from the store ?
    }
  }

  async signIn(
    input: string,
    options?: OAuthAuthorizeOptions & { signal?: AbortSignal },
  ) {
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
    options?: Omit<OAuthAuthorizeOptions, 'state'> & { signal?: AbortSignal },
  ): Promise<OAuthClient> {
    // Open new window asap to prevent popup busting by browsers
    const popupFeatures = 'width=600,height=600,menubar=no,toolbar=no'
    let popup = window.open('about:blank', '_blank', popupFeatures)

    const stateKey = `${Math.random().toString(36).slice(2)}`

    const url = await this.authorize(input, {
      ...options,
      state: `${POPUP_STATE_PREFIX}${stateKey}`,
      display: options?.display ?? 'popup',
    })

    try {
      options?.signal?.throwIfAborted()

      if (popup) {
        popup.window.location.href = url.href
      } else {
        popup = window.open(url.href, '_blank', popupFeatures)
      }

      popup?.focus()

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
        }, 500)
      })
    } finally {
      popup?.close()
    }
  }

  async signInCallback() {
    // Only if the current URL is a redirect URI
    if (
      this.clientMetadata.redirect_uris.every(
        (uri) => new URL(uri).pathname !== location.pathname,
      )
    ) {
      return null
    }

    const params =
      this.responseMode === 'fragment'
        ? new URLSearchParams(location.hash.slice(1))
        : new URLSearchParams(location.search)

    // Only if the current URL contain oauth response params
    if (!params.has('state') || !(params.has('code') || params.has('error'))) {
      return null
    }

    // Replace the current history entry without the query string (this will
    // prevent the following code to run again if the user refreshes the page)
    history.replaceState(null, '', location.pathname)

    return this.callback(params)
      .then(async (result) => {
        if (result.state?.startsWith(POPUP_STATE_PREFIX)) {
          const stateKey = result.state.slice(POPUP_STATE_PREFIX.length)

          await this.popupStore.set(stateKey, {
            status: 'fulfilled',
            value: {
              sessionId: result.client.sessionId,
            },
          })

          throw new LoginContinuedInParentWindowError() // signInPopup
        }

        return result
      })
      .catch(async (err) => {
        if (
          err instanceof OAuthCallbackError &&
          err.state?.startsWith(POPUP_STATE_PREFIX)
        ) {
          const stateKey = err.state.slice(POPUP_STATE_PREFIX.length)

          await this.popupStore.set(stateKey, {
            status: 'rejected',
            reason: {
              message: err.message,
              params: Array.from(err.params.entries()),
            },
          })

          throw new LoginContinuedInParentWindowError() // signInPopup
        }

        // Most probable cause at this point is that the "state" parameter is
        // invalid.
        throw err
      })
  }

  async [Symbol.asyncDispose]() {
    await this.database[Symbol.asyncDispose]()
  }
}

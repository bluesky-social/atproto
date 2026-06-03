import { openAuthSessionAsync } from 'expo-web-browser'
import {
  AuthorizeOptions,
  OAuthClient,
  OAuthSession,
  RuntimeImplementation,
} from '@atproto/oauth-client'
import { default as NativeModule } from './ExpoAtprotoOAuthClientModule.js'
import { ExpoOAuthClientInterface } from './expo-oauth-client-interface.js'
import { ExpoOAuthClientOptions } from './expo-oauth-client-options.js'
import { ExpoKey } from './utils/expo-key.js'
import {
  AuthorizationServerMetadataCache,
  DidCache,
  DpopNonceCache,
  HandleCache,
  ProtectedResourceMetadataCache,
  SessionStore,
  StateStore,
} from './utils/stores.js'

export const CUSTOM_URI_SCHEME_REGEX = /^(?:[^.]+(?:\.[^.]+)+):\/(?:[^/].*)?$/
const isCustomUriScheme = (uri: string) => CUSTOM_URI_SCHEME_REGEX.test(uri)

const runtimeImplementation: RuntimeImplementation = {
  createKey: async (algs) => ExpoKey.generate(algs),
  digest: async (bytes, { name }) =>
    NativeModule.digest(bytes, name) as Promise<Uint8Array<ArrayBuffer>>,
  getRandomValues: async (length) => NativeModule.getRandomValues(length),
}

export class ExpoOAuthClient
  extends OAuthClient
  implements ExpoOAuthClientInterface
{
  constructor(options: ExpoOAuthClientOptions) {
    super({
      ...options,
      responseMode: options.responseMode ?? 'query',
      keyset: undefined,
      runtimeImplementation,
      sessionStore: new SessionStore(),
      stateStore: new StateStore(),
      didCache: new DidCache(),
      handleCache: new HandleCache(),
      dpopNonceCache: new DpopNonceCache(),
      authorizationServerMetadataCache: new AuthorizationServerMetadataCache(),
      protectedResourceMetadataCache: new ProtectedResourceMetadataCache(),
    })
  }

  async handleCallback(): Promise<null | OAuthSession> {
    return null
  }

  async signIn(
    input: string,
    options?: AuthorizeOptions,
  ): Promise<OAuthSession> {
    const redirectUri =
      options?.redirect_uri ??
      this.clientMetadata.redirect_uris.find(isCustomUriScheme)

    if (!redirectUri) {
      throw new TypeError(
        'A redirect URI with a custom scheme is required for Expo OAuth.',
      )
    }

    const url = await this.authorize(input, {
      ...options,
      redirect_uri: redirectUri,
      display: options?.display ?? 'touch',
    })

    const result = await openAuthSessionAsync(url.toString(), redirectUri, {
      dismissButtonStyle: 'cancel', // iOS only
      preferEphemeralSession: false, // iOS only
    })

    if (result.type === 'success') {
      const callbackUrl = new URL(result.url)
      const params =
        this.responseMode === 'fragment'
          ? new URLSearchParams(callbackUrl.hash.slice(1))
          : callbackUrl.searchParams

      const { session } = await this.callback(params, {
        redirect_uri: redirectUri,
      })
      return session
    } else {
      throw new Error(`Authentication cancelled: ${result.type}`)
    }
  }

  async [Symbol.asyncDispose]() {
    // Noop. Needed because the interface extends AsyncDisposable (required by
    // the web implementation) but there's nothing to dispose on native.
  }
}

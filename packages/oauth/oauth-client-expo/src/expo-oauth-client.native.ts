import { openAuthSessionAsync } from 'expo-web-browser'
import {
  AuthorizeOptions,
  OAuthClient,
  OAuthSession,
} from '@atproto/oauth-client'
import { default as NativeModule } from './ExpoAtprotoOAuthClientModule'
import { ExpoOAuthClientInterface } from './expo-oauth-client-interface'
import { ExpoOAuthClientOptions } from './expo-oauth-client-options'
import { ExpoKey } from './utils/expo-key'
import {
  AuthorizationServerMetadataCache,
  DidCache,
  DpopNonceCache,
  HandleCache,
  ProtectedResourceMetadataCache,
  SessionStore,
  StateStore,
} from './utils/stores'

export const CUSTOM_URI_SCHEME_REGEX = /^(?:[^.]+(?:\.[^.]+)+):\/(?:[^/].*)?$/
const isCustomUriScheme = (uri: string) => CUSTOM_URI_SCHEME_REGEX.test(uri)

export class ExpoOAuthClient
  extends OAuthClient
  implements ExpoOAuthClientInterface
{
  readonly #disposables: DisposableStack

  constructor(options: ExpoOAuthClientOptions) {
    using stack = new DisposableStack()

    super({
      ...options,
      responseMode: options.responseMode ?? 'query',
      keyset: undefined,
      runtimeImplementation: {
        createKey: async (algs) => ExpoKey.generate(algs),
        digest: async (bytes, { name }) => NativeModule.digest(bytes, name),
        getRandomValues: async (length) => NativeModule.getRandomValues(length),
      },
      sessionStore: stack.use(new SessionStore()),
      stateStore: stack.use(new StateStore()),
      didCache: stack.use(new DidCache()),
      handleCache: stack.use(new HandleCache()),
      dpopNonceCache: stack.use(new DpopNonceCache()),
      authorizationServerMetadataCache: stack.use(
        new AuthorizationServerMetadataCache(),
      ),
      protectedResourceMetadataCache: stack.use(
        new ProtectedResourceMetadataCache(),
      ),
    })

    stack.defer(() => super[Symbol.dispose]?.())

    this.#disposables = stack.move()
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

    console.debug('openAuthSessionAsync', { url, redirectUri })

    const result = await openAuthSessionAsync(url.toString(), redirectUri)

    console.debug('AUTH SESSION RESULT', result)

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

  [Symbol.dispose]() {
    this.#disposables.dispose()
  }
}

import { Fetch } from '@atproto/fetch'
import {
  DidDocument,
  ResolvedHandle,
  UniversalIdentityResolver,
  UniversalIdentityResolverOptions,
} from '@atproto/identity-resolver'
import {
  InternalStateData,
  OAuthAuthorizeOptions,
  OAuthClientFactory,
  Session,
} from '@atproto/oauth-client'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'
import {
  IsomorphicOAuthServerMetadataResolver,
  OAuthServerMetadata,
} from '@atproto/oauth-server-metadata-resolver'

import { ReactNativeCryptoImplementation } from './react-native-crypto-implementation.js'
import { ReactNativeStoreWithKey } from './react-native-store-with-key.js'
import { ReactNativeStore } from './react-native-store.js'

export type ReactNativeOAuthClientFactoryOptions = {
  clientMetadata: OAuthClientMetadata
  plcDirectoryUrl?: UniversalIdentityResolverOptions['plcDirectoryUrl']
  atprotoLexiconUrl?: UniversalIdentityResolverOptions['atprotoLexiconUrl']
  fetch?: Fetch
}

export class ReactNativeOAuthClientFactory extends OAuthClientFactory {
  constructor({
    clientMetadata,
    plcDirectoryUrl,
    atprotoLexiconUrl,
  }: ReactNativeOAuthClientFactoryOptions) {
    super({
      clientMetadata,
      responseMode: 'query',
      fetch,
      cryptoImplementation: new ReactNativeCryptoImplementation(),
      sessionStore: new ReactNativeStoreWithKey<Session>(({ tokenSet }) =>
        tokenSet.refresh_token || !tokenSet.expires_at
          ? null
          : new Date(tokenSet.expires_at),
      ),
      stateStore: new ReactNativeStoreWithKey<InternalStateData>(
        () => new Date(Date.now() + 600e3),
      ),
      metadataResolver: new IsomorphicOAuthServerMetadataResolver({
        fetch,
        cache: new ReactNativeStore<OAuthServerMetadata>(
          () => new Date(Date.now() + 60e3),
        ),
      }),
      identityResolver: UniversalIdentityResolver.from({
        fetch,
        plcDirectoryUrl,
        atprotoLexiconUrl,
        didCache: new ReactNativeStore<DidDocument>(
          () => new Date(Date.now() + 60e3),
        ),
        handleCache: new ReactNativeStore<ResolvedHandle>(
          () => new Date(Date.now() + 60e3),
        ),
      }),
      dpopNonceCache: new ReactNativeStore<string>(
        () => new Date(Date.now() + 600e3),
      ),
    })
  }

  async signIn(
    input: string,
    options?: OAuthAuthorizeOptions & { signal?: AbortSignal },
  ) {
    const url = await this.authorize(input, options)
    const params = await this.openNativeLoginUi(url)
    const { client } = await this.callback(params)
    return client
  }

  async openNativeLoginUi(url: URL): Promise<URLSearchParams> {
    // TODO: implement this
    return new URLSearchParams({
      error: 'invalid_request',
      error_description: 'Not implemented',
      state: url.searchParams.get('state') ?? '',
      issuer: url.searchParams.get('iss') ?? '',
    })
  }
}

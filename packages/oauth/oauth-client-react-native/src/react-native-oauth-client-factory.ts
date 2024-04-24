import { DidResolver, DidResolverOptions } from '@atproto-labs/did-resolver'
import {
  AppViewHandleResolver,
  CachedHandleResolver,
  HandleResolver,
} from '@atproto-labs/handle-resolver'
import { IdentityResolver } from '@atproto-labs/identity-resolver'
import {
  InternalStateData,
  OAuthAuthorizeOptions,
  OAuthClient,
  Session,
} from '@atproto/oauth-client'
import { OAuthClientMetadata } from '@atproto/oauth-types'

import { ReactNativeCryptoImplementation } from './react-native-crypto-implementation.js'
import { ReactNativeStoreWithKey } from './react-native-store-with-key.js'

export type ReactNativeOAuthClientOptions = {
  clientMetadata: OAuthClientMetadata
  handleResolver: HandleResolver | string | URL
  plcDirectoryUrl?: DidResolverOptions['plcDirectoryUrl']
  fetch?: typeof globalThis.fetch
}

export class ReactNativeOAuthClient extends OAuthClient {
  constructor({
    clientMetadata,
    plcDirectoryUrl,
    handleResolver,
    fetch = globalThis.fetch,
  }: ReactNativeOAuthClientOptions) {
    super({
      clientMetadata,
      responseMode: 'query',
      // Compatibility: react-native typings do not allow URL as RequestInit
      fetch: (input, init) =>
        fetch(input instanceof URL ? input.href : input, init),
      cryptoImplementation: new ReactNativeCryptoImplementation(),
      sessionStore: new ReactNativeStoreWithKey<Session>(({ tokenSet }) =>
        tokenSet.refresh_token || !tokenSet.expires_at
          ? null
          : new Date(tokenSet.expires_at),
      ),
      stateStore: new ReactNativeStoreWithKey<InternalStateData>(
        () => new Date(Date.now() + 600e3),
      ),
      identityResolver: new IdentityResolver(
        new CachedHandleResolver(
          AppViewHandleResolver.from(handleResolver, { fetch }),
        ),
        new DidResolver({ fetch, plcDirectoryUrl }),
      ),
    })
  }

  async signIn(
    input: string,
    options?: OAuthAuthorizeOptions & { signal?: AbortSignal },
  ) {
    const url = await this.authorize(input, options)
    const params = await this.openNativeLoginUi(url)
    const { agent } = await this.callback(params)
    return agent
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

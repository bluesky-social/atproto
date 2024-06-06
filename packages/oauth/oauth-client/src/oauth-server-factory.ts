import { GlobalFetch } from '@atproto-labs/fetch'
import { Key, Keyset } from '@atproto/jwk'
import { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'

import { CryptoWrapper } from './crypto-wrapper.js'
import { OAuthResolver } from './oauth-resolver.js'
import { DpopNonceCache, OAuthServerAgent } from './oauth-server-agent.js'
import { GetCachedOptions } from './oauth-authorization-server-metadata-resolver.js'
import { ClientMetadata } from './types.js'

export class OAuthServerFactory {
  constructor(
    readonly clientMetadata: ClientMetadata,
    readonly crypto: CryptoWrapper,
    readonly resolver: OAuthResolver,
    readonly fetch: GlobalFetch,
    readonly keyset: Keyset | undefined,
    readonly dpopNonceCache: DpopNonceCache,
  ) {}

  async fromIssuer(issuer: string, dpopKey: Key, options?: GetCachedOptions) {
    const serverMetadata = await this.resolver.resolveMetadata(issuer, options)
    return this.fromMetadata(serverMetadata, dpopKey)
  }

  async fromMetadata(
    serverMetadata: OAuthAuthorizationServerMetadata,
    dpopKey: Key,
  ) {
    return new OAuthServerAgent(
      dpopKey,
      serverMetadata,
      this.clientMetadata,
      this.dpopNonceCache,
      this.resolver,
      this.crypto,
      this.keyset,
      this.fetch,
    )
  }
}

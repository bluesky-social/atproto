import { Key, Keyset } from '@atproto/jwk'
import { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'
import { Fetch } from '@atproto-labs/fetch'
import { GetCachedOptions } from './oauth-authorization-server-metadata-resolver.js'
import { OAuthResolver } from './oauth-resolver.js'
import { DpopNonceCache, OAuthServerAgent } from './oauth-server-agent.js'
import { Runtime } from './runtime.js'
import { ClientMetadata } from './types.js'

export class OAuthServerFactory {
  constructor(
    readonly clientMetadata: ClientMetadata,
    readonly runtime: Runtime,
    readonly resolver: OAuthResolver,
    readonly fetch: Fetch,
    readonly keyset: Keyset | undefined,
    readonly dpopNonceCache: DpopNonceCache,
  ) {}

  async fromIssuer(issuer: string, dpopKey: Key, options?: GetCachedOptions) {
    const serverMetadata = await this.resolver.getAuthorizationServerMetadata(
      issuer,
      options,
    )
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
      this.runtime,
      this.keyset,
      this.fetch,
    )
  }
}

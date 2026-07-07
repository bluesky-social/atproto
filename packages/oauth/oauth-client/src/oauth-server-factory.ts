import type { Key, Keyset } from '@atproto/jwk'
import type { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'
import type { Fetch } from '@atproto-labs/fetch'
import type { GetCachedOptions } from './oauth-authorization-server-metadata-resolver.js'
import type { ClientAuthMethod } from './oauth-client-auth.js'
import type { OAuthResolver } from './oauth-resolver.js'
import { type DpopNonceCache, OAuthServerAgent } from './oauth-server-agent.js'
import type { Runtime } from './runtime.js'
import type { ClientMetadata } from './types.js'

export class OAuthServerFactory {
  constructor(
    readonly clientMetadata: ClientMetadata,
    readonly runtime: Runtime,
    readonly resolver: OAuthResolver,
    readonly fetch: Fetch,
    readonly keyset: Keyset | undefined,
    readonly dpopNonceCache: DpopNonceCache,
  ) {}

  /**
   * @param authMethod `undefined` means that we are restoring a session that
   * was created before we started storing the `authMethod` in the session. In
   * that case, we will use the first key from the keyset.
   *
   * Support for this might be removed in the future.
   *
   * @throws see {@link OAuthServerFactory.fromMetadata}
   */
  async fromIssuer(
    issuer: string,
    authMethod: ClientAuthMethod,
    dpopKey: Key,
    options?: GetCachedOptions,
  ) {
    const serverMetadata = await this.resolver.getAuthorizationServerMetadata(
      issuer,
      options,
    )

    return this.fromMetadata(serverMetadata, authMethod, dpopKey)
  }

  /**
   * @throws see {@link OAuthServerAgent}
   */
  async fromMetadata(
    serverMetadata: OAuthAuthorizationServerMetadata,
    authMethod: ClientAuthMethod,
    dpopKey: Key,
  ) {
    return new OAuthServerAgent(
      authMethod,
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

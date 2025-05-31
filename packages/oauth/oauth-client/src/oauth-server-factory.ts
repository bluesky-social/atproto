import { Key, Keyset } from '@atproto/jwk'
import { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'
import { Fetch } from '@atproto-labs/fetch'
import { GetCachedOptions } from './oauth-authorization-server-metadata-resolver.js'
import {
  ClientAuthMethod,
  negotiateClientAuthMethod,
} from './oauth-client-auth.js'
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
    authMethod: 'legacy' | ClientAuthMethod,
    dpopKey: Key,
    options?: GetCachedOptions,
  ) {
    const serverMetadata = await this.resolver.getAuthorizationServerMetadata(
      issuer,
      options,
    )

    if (authMethod === 'legacy') {
      // @NOTE Because we were previously not storing the authMethod in the
      // session data, we provide a backwards compatible implementation by
      // computing it here.
      authMethod = negotiateClientAuthMethod(
        serverMetadata,
        this.clientMetadata,
        this.keyset,
      )
    }

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

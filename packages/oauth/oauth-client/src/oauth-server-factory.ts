import { Key, Keyset } from '@atproto/jwk'
import { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'
import { Fetch } from '@atproto-labs/fetch'
import { FALLBACK_ALG } from './constants.js'
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

  /**
   * @param authKid `undefined` means that we are restoring a session that was
   * created before we started storing the `authKid` in the session. In that
   * case, we will use the first key from the keyset.
   *
   * Support for this might be removed in the future.
   */
  async fromIssuer(
    issuer: string,
    dpopKey: Key,
    authKid: string | null | undefined,
    options?: GetCachedOptions,
  ) {
    const serverMetadata = await this.resolver.getAuthorizationServerMetadata(
      issuer,
      options,
    )

    if (authKid === undefined) {
      // Legacy: When restoring legacy stored sessions, use the "first" key from
      // the keyset, using the same logic as the code was using before the
      // `authKid` started being stored.
      const [key] =
        this.keyset &&
        this.clientMetadata['token_endpoint_auth_method'] !== 'none' &&
        serverMetadata['token_endpoint_auth_methods_supported']?.includes(
          'private_key_jwt',
        )
          ? this.keyset.findKey({
              use: 'sig',
              alg:
                serverMetadata[
                  'token_endpoint_auth_signing_alg_values_supported'
                ] ?? FALLBACK_ALG,
            })
          : [null]

      const kid = key ? key.kid : null

      // Fool-proof (should already have been enforced) & type safety
      if (kid === undefined) throw new Error(`The key does not define a kid`)

      return this.fromMetadata(serverMetadata, dpopKey, kid)
    }

    return this.fromMetadata(serverMetadata, dpopKey, authKid)
  }

  async fromMetadata(
    serverMetadata: OAuthAuthorizationServerMetadata,
    dpopKey: Key,
    authKid: string | null,
  ) {
    if (authKid != null && !this.keyset) {
      // Restoring an auth session but the client does not define a keyset
      // anymore. The session will not be usable. Not that if the keyset is
      // present, and a kid is provided, `findKey()` will throw if the key is
      // no (longer) found.
      throw new Error(`No key found for kid: ${authKid}`)
    }

    const [authKey] =
      !this.keyset || authKid === null
        ? // Use "none" auth method
          [null]
        : // Use "private_key_jwt" auth method. Throws if no key is found (no
          // longer available, or server changed its supported algorithms).
          this.keyset.findKey({
            kid: authKid,
            use: 'sig',
            alg: serverMetadata[
              'token_endpoint_auth_signing_alg_values_supported'
            ],
          })

    return new OAuthServerAgent(
      dpopKey,
      authKey,
      serverMetadata,
      this.clientMetadata,
      this.dpopNonceCache,
      this.resolver,
      this.runtime,
      this.fetch,
    )
  }
}

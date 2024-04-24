import { Fetch } from '@atproto/fetch'
import { IdentityResolver } from '@atproto/identity-resolver'
import { Key, Keyset } from '@atproto/jwk'
import { OAuthClientMetadata, OAuthServerMetadata } from '@atproto/oauth-types'
import { SimpleStore } from '@atproto/simple-store'
import { SimpleStoreMemory } from '@atproto/simple-store-memory'

import { CryptoImplementation } from './crypto-implementation.js'
import { CryptoWrapper } from './crypto-wrapper.js'
import { OAuthResolver } from './oauth-resolver.js'
import { OAuthServerMetadataResolver } from './oauth-server-metadata-resolver.js'
import { OAuthServer } from './oauth-server.js'
import { OAuthClientMetadataId } from './types.js'
import { validateClientMetadata } from './validate-client-metadata.js'

export type OAuthServerFactoryOptions = {
  clientMetadata: OAuthClientMetadata
  cryptoImplementation: CryptoImplementation
  identityResolver: IdentityResolver
  fetch?: Fetch
  keyset?: Keyset
  metadataCache?: SimpleStore<string, OAuthServerMetadata>
  dpopNonceCache?: SimpleStore<string, string>
}

export class OAuthServerFactory {
  readonly clientMetadata: OAuthClientMetadataId
  readonly metadataResolver: OAuthServerMetadataResolver
  readonly crypto: CryptoWrapper
  readonly resolver: OAuthResolver
  readonly fetch: Fetch
  readonly keyset?: Keyset
  readonly dpopNonceCache: SimpleStore<string, string>

  constructor({
    identityResolver,
    clientMetadata,
    cryptoImplementation,
    keyset,
    fetch = globalThis.fetch,
    metadataCache = new SimpleStoreMemory<string, OAuthServerMetadata>({
      ttl: 60e3,
      max: 100,
    }),
    dpopNonceCache = new SimpleStoreMemory<string, string>({
      ttl: 60e3,
      max: 100,
    }),
  }: OAuthServerFactoryOptions) {
    validateClientMetadata(clientMetadata, keyset)

    if (!clientMetadata.client_id) {
      throw new TypeError('A client_id property must be specified')
    }

    const metadataResolver = new OAuthServerMetadataResolver(
      metadataCache,
      fetch,
    )

    this.clientMetadata = clientMetadata
    this.metadataResolver = metadataResolver
    this.keyset = keyset
    this.fetch = fetch
    this.dpopNonceCache = dpopNonceCache

    this.crypto = new CryptoWrapper(cryptoImplementation)
    this.resolver = new OAuthResolver(metadataResolver, identityResolver)
  }

  async fromIssuer(issuer: string, dpopKey: Key) {
    const { origin } = new URL(issuer)
    const serverMetadata = await this.metadataResolver.resolve(origin)
    return this.fromMetadata(serverMetadata, dpopKey)
  }

  async fromMetadata(serverMetadata: OAuthServerMetadata, dpopKey: Key) {
    return new OAuthServer(
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

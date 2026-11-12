import { P256Keypair } from '@atproto/crypto'
import { extractPdsUrl } from '@atproto/did'
import { XrpcResponseError, buildAgent, xrpc } from '@atproto/lex-client'
import { SPACE_CREDENTIAL_MAX_AGE_SEC, spaceHostAud } from '@atproto/space'
import { SpaceRef, type SpaceRefString } from '@atproto/syntax'
import { createDidResolver } from '@atproto-labs/did-resolver'
import { CachedGetter, type Getter } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import type { AtprotoDidResolver } from './atproto-did-resolver.js'
import type { ClientAttestationProvider } from './client-attestation-provider.js'
import type { DelegationTokenProvider } from './delegation-token-provider.js'
import { main as getSpaceCredential } from './lexicons/com/atproto/space/getSpaceCredential.js'
import { SpaceCredential } from './space-credential.js'

export type SpaceCredentialProviderOptions = {
  signal?: AbortSignal
  renew?: boolean
}

/**
 * Obtains the space credentials of a {@link SpaceReader}, e.g. to share them
 * between readers of a space.
 */
export type SpaceCredentialProvider = (
  space: SpaceRef,
  options?: SpaceCredentialProviderOptions,
) => Promise<SpaceCredential>

export type BuildSpaceCredentialProviderOptions = {
  /**
   * Provides the delegation tokens exchanged for space credentials. Only
   * spaces with public read access can be read without.
   *
   * @default noDelegationToken
   */
  delegationTokenProvider?: DelegationTokenProvider

  /** For spaces that only grant access to specific apps. */
  clientAttestationProvider?: ClientAttestationProvider

  /**
   * Resolves the space authority and the space's members to their PDS and
   * `#atproto_kem` key.
   */
  didResolver?: AtprotoDidResolver

  /** Used for all requests. */
  fetch?: typeof globalThis.fetch
}

export function buildSpaceCredentialProvider({
  fetch = globalThis.fetch,
  didResolver = createDidResolver({ fetch }),
  clientAttestationProvider,
  delegationTokenProvider,
}: BuildSpaceCredentialProviderOptions): SpaceCredentialProvider {
  return async (space, { signal, renew } = {}) => {
    const [service, delegationToken, clientAttestation] = await Promise.all([
      didResolver
        .resolve(space.spaceDid, { signal, noCache: renew })
        .then(extractPdsUrl),
      delegationTokenProvider?.(space, { signal }),
      clientAttestationProvider?.(spaceHostAud(space.spaceDid)),
    ])

    signal?.throwIfAborted?.()

    const key = await P256Keypair.create()

    signal?.throwIfAborted?.()

    const agent = buildAgent({ fetch, service })
    const res = await xrpc(agent, getSpaceCredential, {
      signal,
      body: {
        space: space.toString(),
        credentialKey: key.did(),
        delegationToken,
        clientAttestation,
      },
    })

    return SpaceCredential.parse(res.body.credential, key)
  }
}

/**
 * Caches the space credentials obtained by `mint` until they need renewal.
 * Concurrent requests for a space share a single mint.
 */
export class SpaceCredentialProviderCache extends CachedGetter<
  // @NOTE We need to use string keys
  SpaceRefString,
  SpaceCredential
> {
  static for(provider: SpaceCredentialProvider): SpaceCredentialProviderCache {
    return new SpaceCredentialProviderCache(async (space, { signal }) => {
      return provider(SpaceRef.parse(space), { signal })
    })
  }

  protected constructor(getter: Getter<SpaceRefString, SpaceCredential>) {
    super(
      getter,
      // @NOTE Credentials are only kept in memory: they hold a non-exportable
      // private key, and persisting them would expose read access to the space.
      new SimpleStoreMemory({
        ttl: SPACE_CREDENTIAL_MAX_AGE_SEC * 1e3,
        ttlAutopurge: true,
      }),
      {
        isStale: (_space, credential) => credential.needsRenewal,
        // Syncers are expected to drop a deleted space, credential included.
        deleteOnError: (err) =>
          err instanceof XrpcResponseError && err.error === 'SpaceDeleted',
      },
    )
  }

  getCredential: SpaceCredentialProvider = async (
    space,
    { signal, renew } = {},
  ) => {
    return this.get(space.toString(), { signal, noCache: renew })
  }
}

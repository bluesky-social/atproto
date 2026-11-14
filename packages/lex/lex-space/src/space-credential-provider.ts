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
import {
  type Notify,
  main as authorizeSpaceSync,
} from './lexicons/com/atproto/space/authorizeSpaceSync.js'
import { SpaceCredential } from './space-credential.js'

/**
 * Where, and with what token, the space host notifies a syncer of updates to a
 * space (with `com.atproto.space.notifySpaceUpdate`).
 */
export type NotifyRegistration = Omit<Notify, '$type'>

/**
 * Provides the registration for notifications of updates to a space, renewed
 * with every credential obtained. The `endpoint` must implement
 * `com.atproto.space.confirmRegistration`, which the space host calls before
 * registering it, and `com.atproto.space.notifySpaceUpdate`. The `token`
 * should be unique to the space, and stay the same across credentials.
 * Resolves `undefined` not to register.
 */
export type NotifyRegistrationProvider = (
  space: SpaceRef,
  options: { signal?: AbortSignal },
) => Promise<NotifyRegistration | undefined>

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
   * Registers for notifications of updates to the space, with each credential
   * obtained. The registration stays active while the latest credential is
   * valid. Obtaining a credential fails with `RegistrationNotConfirmed` if the
   * endpoint does not confirm the registration.
   */
  notifyRegistrationProvider?: NotifyRegistrationProvider

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
  notifyRegistrationProvider,
}: BuildSpaceCredentialProviderOptions): SpaceCredentialProvider {
  return async (space, { signal, renew } = {}) => {
    const [service, delegationToken, clientAttestation, notify] =
      await Promise.all([
        didResolver
          .resolve(space.spaceDid, { signal, noCache: renew })
          .then(extractPdsUrl),
        delegationTokenProvider?.(space, { signal }),
        clientAttestationProvider?.(spaceHostAud(space.spaceDid)),
        notifyRegistrationProvider?.(space, { signal }),
      ])

    signal?.throwIfAborted?.()

    const key = await P256Keypair.create()

    signal?.throwIfAborted?.()

    const agent = buildAgent({ fetch, service })
    const res = await xrpc(agent, authorizeSpaceSync, {
      signal,
      body: {
        space: space.toString(),
        credentialKey: key.did(),
        delegationToken,
        clientAttestation,
        notify,
      },
    })

    return SpaceCredential.parse(res.body.credential, key, {
      spaceRev: res.body.spaceRev,
    })
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
    return new SpaceCredentialProviderCache(
      async (space, { signal, noCache }) => {
        // A renewal re-resolves the authority, e.g. in case it moved to another PDS.
        return provider(SpaceRef.parse(space), { signal, renew: noCache })
      },
    )
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

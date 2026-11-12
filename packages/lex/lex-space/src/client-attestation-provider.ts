import type { Signer } from '@atproto/crypto'
import {
  type UnsignedSpaceToken,
  buildClientAttestation,
  createClientAttestation,
} from '@atproto/space'

export type ClientAttestationProvider = (
  /** The space host the attestation is addressed to. */
  aud: string,
) => Promise<string>

export type ClientAttestationSigner =
  /** An `@atproto/crypto` keypair. */
  | Signer
  /**
   * An `@atproto/jwk` `Keyset` (e.g. an OAuth client's `keyset`), which picks
   * the key and sets `alg` itself.
   */
  | {
      createJwt: (
        header: UnsignedSpaceToken['header'],
        payload: UnsignedSpaceToken['payload'],
      ) => Promise<string>
    }

export type ClientAttestationOptions = {
  /** The signing key's `kid` in the client's JWKS. */
  kid?: string
  /** @default 60 */
  expiresInSec?: number
}

/**
 * Provides attestations, for spaces that only grant access to specific apps,
 * on behalf of the OAuth client `clientId`. `signer` must hold a key published
 * in the client's JWKS.
 *
 * @example
 * ```typescript
 * const reader = SpaceReader.openSpace(com.example.forum, spaceUri, {
 *   delegationTokenProvider: delegationTokenProviderFor(client.agent),
 *   clientAttestationProvider: clientAttestationProviderFor(clientId, keyset),
 * })
 * ```
 */
export function clientAttestationProviderFor(
  clientId: string,
  signer: ClientAttestationSigner,
  options?: ClientAttestationOptions,
): ClientAttestationProvider {
  return async (aud) => {
    const opts = {
      clientId,
      aud,
      kid: options?.kid,
      expiresInSec: options?.expiresInSec,
    }
    if ('createJwt' in signer) {
      const { header, payload } = buildClientAttestation(opts)
      return signer.createJwt(header, payload)
    }
    return createClientAttestation({ ...opts, keypair: signer })
  }
}

/**
 * Provides attestations, for spaces that only grant access to specific apps,
 * signed with the keys of a confidential OAuth client (such as an `OAuthClient`
 * from `@atproto/oauth-client`).
 *
 * @throws {TypeError} if `client` has no `keyset`
 *
 * @example
 * ```typescript
 * const reader = SpaceReader.openSpace(com.example.forum, spaceUri, {
 *   delegationTokenProvider: delegationTokenProviderFor(client.agent),
 *   clientAttestationProvider: clientAttestationProviderForOAuthClient(oauthClient),
 * })
 * ```
 */
export function clientAttestationProviderForOAuthClient(
  client: {
    clientMetadata: { client_id: string }
    keyset?: ClientAttestationSigner
  },
  options?: ClientAttestationOptions,
): ClientAttestationProvider {
  if (!client.keyset) {
    throw new TypeError('A client without keys cannot attest')
  }
  return clientAttestationProviderFor(
    client.clientMetadata.client_id,
    client.keyset,
    options,
  )
}

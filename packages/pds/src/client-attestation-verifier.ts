import type { Redis } from 'ioredis'
import { createLocalJWKSet, jwtVerify } from 'jose'
import { HOUR } from '@atproto/common'
import { jwksPubSchema } from '@atproto/jwk'
import type { ReplayManager } from '@atproto/oauth-provider/verifier'
import {
  type OAuthClientMetadata,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'
import { SPACE_TOKEN_TYPES, parseSpaceToken } from '@atproto/space'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { type Fetch, bindFetch } from '@atproto-labs/fetch'
import { CachedGetter, type GetterOptions } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { SimpleStoreRedis } from '@atproto-labs/simple-store-redis'

type Jwks = ReturnType<typeof jwksPubSchema.parse>

const CACHE_TTL = 1 * HOUR

/**
 * Establishes which application is asking a space authority for a credential.
 *
 * The attestation is a `private_key_jwt` signed by the client's own
 * authentication key, so verifying it means resolving `iss` (the client_id) to
 * its `client-metadata.json`, fetching the JWKS that document publishes, and
 * checking the signature against the key its `kid` names. Skipping any of that
 * would leave `appAccess: #allowList` advisory rather than enforceable, since
 * the client_id is otherwise just a claim.
 */
export class ClientAttestationVerifier {
  private readonly metadata: CachedGetter<string, OAuthClientMetadata>
  private readonly jwks: CachedGetter<string, Jwks>

  constructor(
    safeFetch: Fetch,
    private readonly replayManager: ReplayManager,
    redis?: Redis,
  ) {
    const fetch = bindFetch(safeFetch)

    this.metadata = new CachedGetter<string, OAuthClientMetadata>(
      async (clientId, options) => {
        const json = await fetchJson(fetch, clientId, options)
        return oauthClientMetadataSchema.parse(json)
      },
      redis
        ? new SimpleStoreRedis(redis, {
            ttl: CACHE_TTL,
            keyPrefix: 'space-client-metadata:',
          })
        : new SimpleStoreMemory({ max: 500, ttl: CACHE_TTL }),
    )

    this.jwks = new CachedGetter<string, Jwks>(
      async (uri, options) => {
        const json = await fetchJson(fetch, uri, options)
        return jwksPubSchema.parse(json)
      },
      redis
        ? new SimpleStoreRedis(redis, {
            ttl: CACHE_TTL,
            keyPrefix: 'space-client-jwks:',
          })
        : new SimpleStoreMemory({ max: 500, ttl: CACHE_TTL }),
    )
  }

  /**
   * Returns the verified client_id. `expectedAud` is the space host the
   * attestation must be addressed to, so one minted for another authority
   * cannot be replayed here.
   */
  async verify(attestation: string, expectedAud: string): Promise<string> {
    const { payload } = parseSpaceToken('clientAttestation', attestation)
    const clientId = payload.iss

    const metadata = await this.metadata
      .get(clientId)
      .catch(invalid(`Could not resolve client metadata for "${clientId}"`))

    const keys = await this.resolveKeys(clientId, metadata)

    await jwtVerify(attestation, createLocalJWKSet(keys), {
      issuer: clientId,
      subject: clientId,
      audience: expectedAud,
      typ: SPACE_TOKEN_TYPES.clientAttestation.typ,
      requiredClaims: ['jti', 'exp'],
    }).catch(invalid(`Invalid client attestation for "${clientId}"`))

    // Verify the signature before consuming the jti.
    const unique = await this.replayManager.uniqueSpaceToken(
      'attestation',
      clientId,
      payload.jti,
      payload.exp,
    )
    if (!unique) {
      throw new InvalidRequestError(
        `Client attestation for "${clientId}" has already been used`,
        'InvalidClientAttestation',
      )
    }

    return clientId
  }

  private async resolveKeys(
    clientId: string,
    metadata: OAuthClientMetadata,
  ): Promise<Jwks> {
    if (metadata.jwks) return metadata.jwks

    const uri = metadata.jwks_uri
    if (!uri) {
      throw new InvalidRequestError(
        `Client "${clientId}" publishes no keys to verify an attestation against`,
        'InvalidClientAttestation',
      )
    }

    // Fetched through our own cached getter rather than jose's remote key set so
    // that the SSRF-guarded fetch and the shared cache both apply.
    return this.jwks
      .get(uri)
      .catch(invalid(`Could not resolve client JWKS from "${uri}"`))
  }
}

const invalid =
  (message: string) =>
  (cause: unknown): never => {
    throw new InvalidRequestError(message, 'InvalidClientAttestation', {
      cause,
    })
  }

async function fetchJson(
  fetch: (req: Request) => Promise<Response>,
  url: string,
  options?: GetterOptions,
): Promise<unknown> {
  const res = await fetch(
    new Request(url, {
      headers: {
        accept: 'application/json',
        ...(options?.noCache ? { 'cache-control': 'no-cache' } : undefined),
      },
      signal: options?.signal,
      redirect: 'error',
    }),
  )
  if (!res.ok) {
    throw new Error(`Unexpected status ${res.status} fetching "${url}"`)
  }
  return res.json()
}

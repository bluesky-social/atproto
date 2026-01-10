import { createHash } from 'node:crypto'
import { EmbeddedJWK, calculateJwkThumbprint, errors, jwtVerify } from 'jose'
import { z } from 'zod'
import { ValidationError } from '@atproto/jwk'
import { DPOP_NONCE_MAX_AGE } from '../constants.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { UseDpopNonceError } from '../errors/use-dpop-nonce-error.js'
import { ifURL } from '../lib/util/cast.js'
import {
  DpopNonce,
  DpopSecret,
  dpopSecretSchema,
  rotationIntervalSchema,
} from './dpop-nonce.js'
import { DpopProof } from './dpop-proof.js'

const { JOSEError } = errors

export { DpopNonce, type DpopSecret }

export const dpopManagerOptionsSchema = z.object({
  /**
   * Set this to `false` to disable the use of nonces in DPoP proofs. Set this
   * to a secret Uint8Array or hex encoded string to use a predictable seed for
   * all nonces (typically useful when multiple instances are running). Leave
   * undefined to generate a random seed at startup.
   */
  dpopSecret: z.union([z.literal(false), dpopSecretSchema]).optional(),
  dpopRotationInterval: rotationIntervalSchema.optional(),
})
export type DpopManagerOptions = z.input<typeof dpopManagerOptionsSchema>

export class DpopManager {
  protected readonly dpopNonce?: DpopNonce

  constructor(options: DpopManagerOptions = {}) {
    const { dpopSecret, dpopRotationInterval } =
      dpopManagerOptionsSchema.parse(options)
    this.dpopNonce =
      dpopSecret === false
        ? undefined
        : new DpopNonce(dpopSecret, dpopRotationInterval)
  }

  nextNonce(): string | undefined {
    return this.dpopNonce?.next()
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-4.3}
   */
  async checkProof(
    httpMethod: string,
    httpUrl: Readonly<URL>,
    httpHeaders: Record<string, undefined | string | string[]>,
    accessToken?: string,
  ): Promise<null | DpopProof> {
    // Fool proofing against use of empty string
    if (!httpMethod) {
      throw new TypeError('HTTP method is required')
    }

    const proof = extractProof(httpHeaders)
    if (!proof) return null

    const { protectedHeader, payload } = await jwtVerify(proof, EmbeddedJWK, {
      typ: 'dpop+jwt',
      maxTokenAge: 10, // Will ensure presence & validity of "iat" claim
      clockTolerance: DPOP_NONCE_MAX_AGE / 1e3,
    }).catch((err) => {
      throw wrapInvalidDpopProofError(err, 'Failed to verify DPoP proof')
    })

    // @NOTE For legacy & backwards compatibility reason, we cannot use
    // `jwtPayloadSchema` here as it will reject DPoP proofs containing a query
    // or fragment component in the "htu" claim.

    // const { ath, htm, htu, jti, nonce } = await jwtPayloadSchema
    //   .parseAsync(payload)
    //   .catch((err) => {
    //     throw buildInvalidDpopProofError('Invalid DPoP proof', err)
    //   })

    // @TODO Uncomment previous lines (and remove redundant checks bellow) once
    // we decide to drop legacy support.
    const { ath, htm, htu, jti, nonce } = payload

    if (nonce !== undefined && typeof nonce !== 'string') {
      throw new InvalidDpopProofError('Invalid DPoP "nonce" type')
    }

    if (!jti || typeof jti !== 'string') {
      throw new InvalidDpopProofError('DPoP "jti" missing')
    }

    // Note rfc9110#section-9.1 states that the method name is case-sensitive
    if (!htm || htm !== httpMethod) {
      throw new InvalidDpopProofError('DPoP "htm" mismatch')
    }

    if (!htu || typeof htu !== 'string') {
      throw new InvalidDpopProofError('Invalid DPoP "htu" type')
    }

    // > To reduce the likelihood of false negatives, servers SHOULD employ
    // > syntax-based normalization (Section 6.2.2 of [RFC3986]) and
    // > scheme-based normalization (Section 6.2.3 of [RFC3986]) before
    // > comparing the htu claim.
    //
    // RFC9449 section 4.3. Checking DPoP Proofs - https://datatracker.ietf.org/doc/html/rfc9449#section-4.3
    if (!htu || parseHtu(htu) !== normalizeHtuUrl(httpUrl)) {
      throw new InvalidDpopProofError('DPoP "htu" mismatch')
    }

    if (!nonce && this.dpopNonce) {
      throw new UseDpopNonceError()
    }

    if (nonce && !this.dpopNonce?.check(nonce)) {
      throw new UseDpopNonceError('DPoP "nonce" mismatch')
    }

    if (accessToken) {
      const accessTokenHash = createHash('sha256').update(accessToken).digest()
      if (ath !== accessTokenHash.toString('base64url')) {
        throw new InvalidDpopProofError('DPoP "ath" mismatch')
      }
    } else if (ath !== undefined) {
      throw new InvalidDpopProofError('DPoP "ath" claim not allowed')
    }

    // @NOTE we can assert there is a jwk because the jwtVerify used the
    // EmbeddedJWK key getter mechanism.
    const jwk = protectedHeader.jwk!
    const jkt = await calculateJwkThumbprint(jwk, 'sha256').catch((err) => {
      throw wrapInvalidDpopProofError(err, 'Failed to calculate jkt')
    })

    // @NOTE We freeze the proof to prevent accidental modification (esp. from
    // hooks).
    return Object.freeze({ jti, jkt, htm, htu })
  }
}

function extractProof(
  httpHeaders: Record<string, undefined | string | string[]>,
): string | null {
  const dpopHeader = httpHeaders['dpop']
  switch (typeof dpopHeader) {
    case 'string':
      if (dpopHeader) return dpopHeader
      throw new InvalidDpopProofError('DPoP header cannot be empty')
    case 'object':
      // @NOTE the "0" case should never happen a node.js HTTP server will only
      // return an array if the header is set multiple times.
      if (dpopHeader.length === 1 && dpopHeader[0]) return dpopHeader[0]!
      throw new InvalidDpopProofError('DPoP header must contain a single proof')
    default:
      return null
  }
}

/**
 * Constructs the HTTP URI (htu) claim as defined in RFC9449.
 *
 * The htu claim is the normalized URL of the HTTP request, excluding the query
 * string and fragment. This function ensures that the URL is normalized by
 * removing the search and hash components, as well as by using an URL object to
 * simplify the pathname (e.g. removing dot segments).
 *
 * @returns The normalized URL as a string.
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-4.3}
 */
function normalizeHtuUrl(url: Readonly<URL>): string {
  // NodeJS's `URL` normalizes the pathname, so we can just use that.
  return url.origin + url.pathname
}

function parseHtu(htu: string): string {
  const url = ifURL(htu)
  if (!url) {
    throw new InvalidDpopProofError('DPoP "htu" is not a valid URL')
  }

  // @NOTE the checks bellow can be removed once once jwtPayloadSchema is used
  // to validate the DPoP proof payload as it already performs these checks
  // (though the htuSchema).

  if (url.password || url.username) {
    throw new InvalidDpopProofError('DPoP "htu" must not contain credentials')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidDpopProofError('DPoP "htu" must be http or https')
  }

  // @NOTE For legacy & backwards compatibility reason, we allow a query and
  // fragment in the DPoP proof's htu. This is not a standard behavior as the
  // htu is not supposed to contain query or fragment.

  // NodeJS's `URL` normalizes the pathname.
  return normalizeHtuUrl(url)
}

function wrapInvalidDpopProofError(
  err: unknown,
  title: string,
): InvalidDpopProofError {
  const msg =
    err instanceof JOSEError || err instanceof ValidationError
      ? `${title}: ${err.message}`
      : title
  return new InvalidDpopProofError(msg, err)
}

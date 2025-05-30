import { createHash } from 'node:crypto'
import { EmbeddedJWK, calculateJwkThumbprint, errors, jwtVerify } from 'jose'
import { z } from 'zod'
import { DPOP_NONCE_MAX_AGE } from '../constants.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { UseDpopNonceError } from '../errors/use-dpop-nonce-error.js'
import {
  DpopNonce,
  DpopSecret,
  dpopSecretSchema,
  rotationIntervalSchema,
} from './dpop-nonce.js'
import { DpopResult } from './dpop-result.js'

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
  ): Promise<null | DpopResult> {
    // Fool proofing against use of empty string
    if (!httpMethod) {
      throw new TypeError('HTTP method is required')
    }

    const proof =
      Array.isArray(httpHeaders['dpop']) && httpHeaders['dpop'].length === 1
        ? httpHeaders['dpop'][0]!
        : httpHeaders['dpop']

    if (proof === undefined) {
      return null
    }

    if (!proof || typeof proof !== 'string') {
      throw new InvalidDpopProofError('DPoP proof required')
    }

    const { protectedHeader, payload } = await jwtVerify(proof, EmbeddedJWK, {
      typ: 'dpop+jwt',
      maxTokenAge: 10, // Will ensure presence & validity of "iat" claim
      clockTolerance: DPOP_NONCE_MAX_AGE / 1e3,
    }).catch((err) => {
      throw err instanceof JOSEError
        ? new InvalidDpopProofError(err.message, err)
        : new InvalidDpopProofError('Invalid DPoP proof', err)
    })

    // @NOTE For legacy & backwards compatibility reason, we cannot use
    // `jwtPayloadSchema` here as it will reject DPoP proofs containing a query
    // or fragment component in the "htu" claim.

    // const { ath, htm, htu, jti, nonce } = await jwtPayloadSchema
    //   .parseAsync(payload)
    //   .catch((err) => {
    //     throw err instanceof ValidationError
    //       ? new InvalidDpopProofError(err.message, err)
    //       : new InvalidDpopProofError('Invalid DPoP proof', err)
    //   })

    // @TODO Uncomment previous lines once we decide to drop legacy support.
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
    if (!htu || normalizeHtu(htu) !== urlToHtu(httpUrl)) {
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
      throw err instanceof JOSEError
        ? new InvalidDpopProofError(err.message)
        : new InvalidDpopProofError('Failed to calculate jkt', err)
    })

    return { jti, jkt, htm, htu }
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
 * @param inputUrl - The URL of the HTTP request.
 * @returns The normalized URL as a string.
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-4.3}
 */
function urlToHtu(url: Readonly<URL>): string {
  // NodeJS's `URL` normalizes the pathname by default, so we can just use the `href` property.
  const urlNorm = url.href

  // Strip the query and fragment from the URL.
  const queryIdx = urlNorm.indexOf('?')
  const fragmentIdx = urlNorm.indexOf('#')

  const endIdx =
    queryIdx === -1
      ? fragmentIdx
      : fragmentIdx === -1
        ? queryIdx
        : Math.min(queryIdx, fragmentIdx)

  return endIdx === -1 ? urlNorm : urlNorm.slice(0, endIdx)
}

function normalizeHtu(htu: string): string | null {
  try {
    // @NOTE For legacy & backwards compatibility reason, we strip the query and
    // fragment from the DPoP proof's htu. This is not a standard behavior as
    // the htu is not supposed to contain query or fragment.

    // return new URL(htu).href

    // @TODO Uncomment previous lines once we decide to drop legacy support.
    // (when `checkProof` uses `jwtPayloadSchema`)

    return urlToHtu(new URL(htu))
  } catch {
    return null
  }
}

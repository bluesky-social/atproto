import { createHash } from 'node:crypto'

import { EmbeddedJWK, calculateJwkThumbprint, errors, jwtVerify } from 'jose'

import { DPOP_NONCE_MAX_AGE } from '../constants.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { UseDpopNonceError } from '../errors/use-dpop-nonce-error.js'
import { DpopNonce, DpopNonceInput } from './dpop-nonce.js'

const { JOSEError } = errors

export { DpopNonce, type DpopNonceInput }
export type DpopManagerOptions = {
  /**
   * Set this to `false` to disable the use of nonces in DPoP proofs. Set this
   * to a secret Uint8Array or hex encoded string to use a predictable seed for
   * all nonces (typically useful when multiple instances are running). Leave
   * undefined to generate a random seed at startup.
   */
  dpopSecret?: false | DpopNonceInput
  dpopStep?: number
}

export class DpopManager {
  protected readonly dpopNonce?: DpopNonce

  constructor({ dpopSecret, dpopStep }: DpopManagerOptions = {}) {
    this.dpopNonce =
      dpopSecret === false ? undefined : DpopNonce.from(dpopSecret, dpopStep)
  }

  nextNonce(): string | undefined {
    return this.dpopNonce?.next()
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-4.3}
   */
  async checkProof(
    proof: unknown,
    htm: string, // HTTP Method
    htu: string | URL, // HTTP URL
    accessToken?: string, // Access Token
  ) {
    if (Array.isArray(proof) && proof.length === 1) {
      proof = proof[0]
    }

    if (!proof || typeof proof !== 'string') {
      throw new InvalidDpopProofError('DPoP proof required')
    }

    const { protectedHeader, payload } = await jwtVerify<{
      iat: number
      jti: string
    }>(proof, EmbeddedJWK, {
      typ: 'dpop+jwt',
      maxTokenAge: 10,
      clockTolerance: DPOP_NONCE_MAX_AGE / 1e3,
      requiredClaims: ['iat', 'jti'],
    }).catch((err) => {
      const message =
        err instanceof JOSEError
          ? `Invalid DPoP proof (${err.message})`
          : 'Invalid DPoP proof'
      throw new InvalidDpopProofError(message, err)
    })

    if (!payload.jti || typeof payload.jti !== 'string') {
      throw new InvalidDpopProofError('Invalid or missing jti property')
    }

    // Note rfc9110#section-9.1 states that the method name is case-sensitive
    if (!htm || htm !== payload['htm']) {
      throw new InvalidDpopProofError('DPoP htm mismatch')
    }

    if (
      payload['nonce'] !== undefined &&
      typeof payload['nonce'] !== 'string'
    ) {
      throw new InvalidDpopProofError('DPoP nonce must be a string')
    }

    if (!payload['nonce'] && this.dpopNonce) {
      throw new UseDpopNonceError()
    }

    if (payload['nonce'] && !this.dpopNonce?.check(payload['nonce'])) {
      throw new UseDpopNonceError('DPoP nonce mismatch')
    }

    const htuNorm = normalizeHtu(htu)
    if (!htuNorm) {
      throw new TypeError('Invalid "htu" argument')
    }

    if (htuNorm !== normalizeHtu(payload['htu'])) {
      throw new InvalidDpopProofError('DPoP htu mismatch')
    }

    if (accessToken) {
      const athBuffer = createHash('sha256').update(accessToken).digest()
      if (payload['ath'] !== athBuffer.toString('base64url')) {
        throw new InvalidDpopProofError('DPoP ath mismatch')
      }
    } else if (payload['ath']) {
      throw new InvalidDpopProofError('DPoP ath not allowed')
    }

    try {
      return {
        protectedHeader,
        payload,
        jkt: await calculateJwkThumbprint(protectedHeader['jwk']!, 'sha256'), // EmbeddedJWK
      }
    } catch (err) {
      const message =
        err instanceof JOSEError ? err.message : 'Failed to calculate jkt'
      throw new InvalidDpopProofError(message, err)
    }
  }
}

/**
 * @note
 * > The htu claim matches the HTTP URI value for the HTTP request in which the
 * > JWT was received, ignoring any query and fragment parts.
 *
 * > To reduce the likelihood of false negatives, servers SHOULD employ
 * > syntax-based normalization (Section 6.2.2 of [RFC3986]) and scheme-based
 * > normalization (Section 6.2.3 of [RFC3986]) before comparing the htu claim.
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-4.3 | RFC9449 section 4.3. Checking DPoP Proofs}
 */
function normalizeHtu(htu: unknown): string | null {
  // Optimization
  if (!htu) return null

  try {
    const url = new URL(String(htu))
    url.hash = ''
    url.search = ''
    return url.href
  } catch {
    return null
  }
}

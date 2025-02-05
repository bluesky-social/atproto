import { base64url } from 'multiformats/bases/base64'
import { Key } from '@atproto/jwk'
import { requestLocalLock } from './lock.js'
import { RuntimeImplementation, RuntimeLock } from './runtime-implementation.js'

export class Runtime {
  readonly hasImplementationLock: boolean
  readonly usingLock: RuntimeLock

  constructor(protected implementation: RuntimeImplementation) {
    const { requestLock } = implementation

    this.hasImplementationLock = requestLock != null
    this.usingLock =
      requestLock?.bind(implementation) ||
      // Falling back to a local lock
      requestLocalLock
  }

  public async generateKey(algs: string[]): Promise<Key> {
    const algsSorted = Array.from(algs).sort(compareAlgos)
    return this.implementation.createKey(algsSorted)
  }

  public async sha256(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text)
    const digest = await this.implementation.digest(bytes, { name: 'sha256' })
    return base64url.baseEncode(digest)
  }

  public async generateNonce(length = 16): Promise<string> {
    const bytes = await this.implementation.getRandomValues(length)
    return base64url.baseEncode(bytes)
  }

  public async generatePKCE(byteLength?: number) {
    const verifier = await this.generateVerifier(byteLength)
    return {
      verifier,
      challenge: await this.sha256(verifier),
      method: 'S256' as const,
    }
  }

  public async calculateJwkThumbprint(jwk) {
    const components = extractJktComponents(jwk)
    const data = JSON.stringify(components)
    return this.sha256(data)
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.1}
   * @note It is RECOMMENDED that the output of a suitable random number generator
   * be used to create a 32-octet sequence. The octet sequence is then
   * base64url-encoded to produce a 43-octet URL safe string to use as the code
   * verifier.
   */
  protected async generateVerifier(byteLength = 32) {
    if (byteLength < 32 || byteLength > 96) {
      throw new TypeError('Invalid code_verifier length')
    }
    const bytes = await this.implementation.getRandomValues(byteLength)
    return base64url.baseEncode(bytes)
  }
}

function extractJktComponents(jwk) {
  const get = (field) => {
    const value = jwk[field]
    if (typeof value !== 'string' || !value) {
      throw new TypeError(`"${field}" Parameter missing or invalid`)
    }
    return value
  }

  switch (jwk.kty) {
    case 'EC':
      return { crv: get('crv'), kty: get('kty'), x: get('x'), y: get('y') }
    case 'OKP':
      return { crv: get('crv'), kty: get('kty'), x: get('x') }
    case 'RSA':
      return { e: get('e'), kty: get('kty'), n: get('n') }
    case 'oct':
      return { k: get('k'), kty: get('kty') }
    default:
      throw new TypeError('"kty" (Key Type) Parameter missing or unsupported')
  }
}

/**
 * 256K > ES (256 > 384 > 512) > PS (256 > 384 > 512) > RS (256 > 384 > 512) > other (in original order)
 */
function compareAlgos(a: string, b: string): number {
  if (a === 'ES256K') return -1
  if (b === 'ES256K') return 1

  for (const prefix of ['ES', 'PS', 'RS']) {
    if (a.startsWith(prefix)) {
      if (b.startsWith(prefix)) {
        const aLen = parseInt(a.slice(2, 5))
        const bLen = parseInt(b.slice(2, 5))

        // Prefer shorter key lengths
        return aLen - bLen
      }
      return -1
    } else if (b.startsWith(prefix)) {
      return 1
    }
  }

  // Don't know how to compare, keep original order
  return 0
}

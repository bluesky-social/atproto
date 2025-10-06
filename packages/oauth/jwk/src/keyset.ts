import {
  ERR_JWKS_NO_MATCHING_KEY,
  ERR_JWK_NOT_FOUND,
  ERR_JWT_INVALID,
  JwkError,
  JwtCreateError,
  JwtVerifyError,
} from './errors.js'
import { PrivateKeyUsage } from './jwk.js'
import { JwksPub } from './jwks.js'
import { unsafeDecodeJwt } from './jwt-decode.js'
import { VerifyOptions, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { ActivityCheckOptions, Key, KeyMatchOptions } from './key.js'
import {
  Override,
  cachedGetter,
  isDefined,
  matchesAny,
  preferredOrderCmp,
} from './util.js'

export type { ActivityCheckOptions, KeyMatchOptions }
export type FindKeyOptions = KeyMatchOptions & ActivityCheckOptions

export type JwtSignHeader = Override<
  JwtHeader,
  Pick<FindKeyOptions, 'alg' | 'kid'>
>

export type JwtPayloadGetter<P = JwtPayload> = (
  header: JwtHeader,
  key: Key,
) => P | PromiseLike<P>

const extractPrivateJwk = (key: Key) => key.privateJwk
const extractPublicJwk = (key: Key) => key.publicJwk

export class Keyset<K extends Key = Key> implements Iterable<K> {
  private readonly keys: readonly K[]

  constructor(
    iterable: Iterable<K | null | undefined | false>,
    /**
     * The preferred algorithms to use when signing a JWT using this keyset.
     *
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7518#section-3.1}
     */
    public readonly preferredSigningAlgorithms: readonly string[] = iterable instanceof
    Keyset
      ? [...iterable.preferredSigningAlgorithms]
      : [
          // Prefer elliptic curve algorithms
          'EdDSA',
          'ES256K',
          'ES256',
          // https://datatracker.ietf.org/doc/html/rfc7518#section-3.5
          'PS256',
          'PS384',
          'PS512',
          'HS256',
          'HS384',
          'HS512',
        ],
  ) {
    const keys: K[] = []

    const keyIds = new Set<string>()
    for (const key of iterable) {
      if (!key) continue

      keys.push(key)

      if (key.kid) {
        if (keyIds.has(key.kid)) throw new JwkError(`Duplicate key: ${key.kid}`)
        else keyIds.add(key.kid)
      }
    }

    this.keys = Object.freeze(keys)
  }

  get size(): number {
    return this.keys.length
  }

  @cachedGetter
  get signAlgorithms(): readonly string[] {
    const algorithms = new Set<string>()
    for (const key of this) {
      if (key.use !== 'sig') continue
      for (const alg of key.algorithms) {
        algorithms.add(alg)
      }
    }
    return Object.freeze(
      [...algorithms].sort(preferredOrderCmp(this.preferredSigningAlgorithms)),
    )
  }

  @cachedGetter
  get publicJwks() {
    return Object.freeze({
      keys: Object.freeze(Array.from(this, extractPublicJwk).filter(isDefined)),
    })
  }

  @cachedGetter
  get privateJwks() {
    return Object.freeze({
      keys: Object.freeze(
        Array.from(this, extractPrivateJwk).filter(isDefined),
      ),
    })
  }

  has(kid: string): boolean {
    return this.keys.some((key) => key.kid === kid)
  }

  get(options: FindKeyOptions): K {
    const key = this.find(options)
    if (key) return key

    throw new JwkError(
      `Key not found ${options.kid ?? options.alg ?? options.usage ?? '<unknown>'}`,
      ERR_JWK_NOT_FOUND,
    )
  }

  find(options: FindKeyOptions): K | undefined {
    for (const key of this.list(options)) {
      return key
    }

    return undefined
  }

  *list<O extends FindKeyOptions>(options: O) {
    for (const key of this) {
      if (key.isActive(options) && key.matches(options)) {
        yield key
      }
    }
  }

  findPrivateKey({
    kid,
    alg,
    usage,
    ...options
  }: FindKeyOptions & { usage: PrivateKeyUsage }): {
    key: Key
    alg: string
  } {
    const matchingKeys: Key[] = []

    // Allow the loop bellow to return early when a single "alg" is provided
    if (Array.isArray(alg) && alg.length === 1) alg = alg[0]

    for (const key of this.list({ ...options, kid, alg, usage })) {
      // Skip negotiation if a single "alg" was provided
      if (typeof alg === 'string') return { key, alg }

      matchingKeys.push(key)
    }

    const isAllowedAlg = matchesAny(alg)
    const candidates = matchingKeys.map(
      (key) => [key, key.algorithms.filter(isAllowedAlg)] as const,
    )

    // Return the first candidates that matches the preferred algorithms
    for (const prefAlg of this.preferredSigningAlgorithms) {
      for (const [matchingKey, matchingAlgs] of candidates) {
        if (matchingAlgs.includes(prefAlg)) {
          return { key: matchingKey, alg: prefAlg }
        }
      }
    }

    // Return any candidate
    for (const [matchingKey, matchingAlgs] of candidates) {
      for (const alg of matchingAlgs) {
        return { key: matchingKey, alg }
      }
    }

    throw new JwkError(
      `No private key found for ${kid || alg || usage}`,
      ERR_JWK_NOT_FOUND,
    )
  }

  [Symbol.iterator](): IterableIterator<K> {
    return this.keys.values()
  }

  async createJwt(
    { alg: sAlg, kid: sKid, ...header }: JwtSignHeader,
    payload: JwtPayload | JwtPayloadGetter,
  ): Promise<SignedJwt> {
    try {
      const { key, alg } = this.findPrivateKey({
        alg: sAlg,
        kid: sKid,
        usage: 'sign',
        allowRevoked: false, // For explicitness (default value is false)
      })
      const protectedHeader = { ...header, alg, kid: key.kid }

      if (typeof payload === 'function') {
        payload = await payload(protectedHeader, key)
      }

      return await key.createJwt(protectedHeader, payload)
    } catch (err) {
      throw JwtCreateError.from(err)
    }
  }

  async verifyJwt<C extends string = never>(
    token: SignedJwt,
    options?: ActivityCheckOptions & VerifyOptions<C>,
  ): Promise<VerifyResult<C> & { key: K }> {
    const { header } = unsafeDecodeJwt(token)
    const { kid, alg } = header

    const errors: unknown[] = []

    for (const key of this.list({ ...options, kid, alg, usage: 'verify' })) {
      try {
        const result = await key.verifyJwt<C>(token, options)
        return { ...result, key }
      } catch (err) {
        errors.push(err)
      }
    }

    switch (errors.length) {
      case 0:
        throw new JwtVerifyError('No key matched', ERR_JWKS_NO_MATCHING_KEY)
      case 1:
        throw JwtVerifyError.from(errors[0], ERR_JWT_INVALID)
      default:
        throw JwtVerifyError.from(errors, ERR_JWT_INVALID)
    }
  }

  toJSON() {
    // Make a copy to allow mutation of the result
    return structuredClone(this.publicJwks) as JwksPub
  }
}

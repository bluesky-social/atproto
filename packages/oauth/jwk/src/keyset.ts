import {
  ERR_JWKS_NO_MATCHING_KEY,
  ERR_JWK_NOT_FOUND,
  ERR_JWT_INVALID,
  JwkError,
  JwtCreateError,
  JwtVerifyError,
} from './errors.js'
import { Jwk } from './jwk.js'
import { Jwks, JwksPub } from './jwks.js'
import { unsafeDecodeJwt } from './jwt-decode.js'
import { VerifyOptions, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { Key } from './key.js'
import {
  DeepReadonly,
  Override,
  UnReadonly,
  cachedGetter,
  isDefined,
  matchesAny,
  preferredOrderCmp,
} from './util.js'

export type JwtSignHeader = Override<JwtHeader, Pick<KeySearch, 'alg' | 'kid'>>

export type JwtPayloadGetter<P = JwtPayload> = (
  header: JwtHeader,
  key: Key,
) => P | PromiseLike<P>

export type KeySearch = {
  use?: 'sig' | 'enc'
  kid?: string | string[]
  alg?: string | string[]
}

const extractPrivateJwk = (key: Key): Jwk | undefined => key.privateJwk
const extractPublicJwk = (key: Key): Jwk | undefined => key.publicJwk

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

    const kids = new Set<string>()
    for (const key of iterable) {
      if (!key) continue

      keys.push(key)

      if (key.kid) {
        if (kids.has(key.kid)) throw new JwkError(`Duplicate key: ${key.kid}`)
        else kids.add(key.kid)
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
  get publicJwks(): DeepReadonly<JwksPub> {
    return {
      keys: Array.from(this, extractPublicJwk).filter(isDefined),
    }
  }

  @cachedGetter
  get privateJwks(): DeepReadonly<Jwks> {
    return {
      keys: Array.from(this, extractPrivateJwk).filter(isDefined),
    }
  }

  has(kid: string): boolean {
    return this.keys.some((key) => key.kid === kid)
  }

  get(search: KeySearch): K {
    for (const key of this.list(search)) {
      return key
    }

    throw new JwkError(
      `Key not found ${search.kid || search.alg || '<unknown>'}`,
      ERR_JWK_NOT_FOUND,
    )
  }

  *list(search: KeySearch): Generator<K> {
    // Optimization: Empty string or empty array will not match any key
    if (search.kid?.length === 0) return
    if (search.alg?.length === 0) return

    for (const key of this) {
      if (search.use && key.use !== search.use) continue

      if (Array.isArray(search.kid)) {
        if (!key.kid || !search.kid.includes(key.kid)) continue
      } else if (search.kid) {
        if (key.kid !== search.kid) continue
      }

      if (Array.isArray(search.alg)) {
        if (!search.alg.some((a) => key.algorithms.includes(a))) continue
      } else if (typeof search.alg === 'string') {
        if (!key.algorithms.includes(search.alg)) continue
      }

      yield key
    }
  }

  findKey({ kid, alg, use }: KeySearch): [key: Key, alg: string] {
    const matchingKeys: Key[] = []

    for (const key of this.list({ kid, alg, use })) {
      // Not a signing key
      if (!key.isPrivate) continue

      // Skip negotiation if a specific "alg" was provided
      if (typeof alg === 'string') return [key, alg]

      matchingKeys.push(key)
    }

    const isAllowedAlg = matchesAny(alg)
    const candidates = matchingKeys.map(
      (key) => [key, key.algorithms.filter(isAllowedAlg)] as const,
    )

    // Return the first candidates that matches the preferred algorithms
    for (const prefAlg of this.preferredSigningAlgorithms) {
      for (const [matchingKey, matchingAlgs] of candidates) {
        if (matchingAlgs.includes(prefAlg)) return [matchingKey, prefAlg]
      }
    }

    // Return any candidate
    for (const [matchingKey, matchingAlgs] of candidates) {
      for (const alg of matchingAlgs) {
        return [matchingKey, alg]
      }
    }

    throw new JwkError(
      `No singing key found for ${kid || alg || use || '<unknown>'}`,
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
      const [key, alg] = this.findKey({ alg: sAlg, kid: sKid, use: 'sig' })
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
    options?: VerifyOptions<C>,
  ): Promise<VerifyResult<C> & { key: K }> {
    const { header } = unsafeDecodeJwt(token)
    const { kid, alg } = header

    const errors: unknown[] = []

    for (const key of this.list({ kid, alg })) {
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

  toJSON(): JwksPub {
    // Make a copy to prevent mutation of the original keyset
    return structuredClone(this.publicJwks) as UnReadonly<JwksPub>
  }
}

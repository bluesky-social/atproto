import { JWTVerifyOptions, SignJWT, jwtVerify } from 'jose'

import { Jwk } from './jwk.js'
import { Jwks } from './jwks.js'
import { Jwt, JwtHeader, JwtPayload } from './jwt.js'
import { Key } from './key.js'
import {
  Override,
  RequiredKey,
  Simplify,
  cachedGetter,
  isDefined,
  matchesAny,
  preferredOrderCmp,
} from './util.js'

export type { JWTVerifyOptions }

export type JwtProtectedHeader = RequiredKey<JwtHeader, 'kid'>
export type JwtPayloadGetter<P = JwtPayload> = (
  protectedHeader: JwtProtectedHeader,
  key: Key,
) => P | PromiseLike<P>

export type JwtSignHeader = Override<JwtHeader, Pick<KeySearch, 'alg' | 'kid'>>

export type JwtVerifyResult<P> = {
  payload: Simplify<P & JwtPayload>
  protectedHeader: JwtProtectedHeader
}

export type KeySearch = {
  use?: 'sig' | 'enc'
  kid?: string
  alg?: string | string[]
}

const extractPrivateJwk = (key: Key): Jwk | undefined => key.privateJwk
const extractPublicJwk = (key: Key): Jwk | undefined => key.publicJwk

export class Keyset<K extends Key = Key> implements Iterable<K> {
  constructor(
    private readonly keys: readonly K[],
    /**
     * The preferred algorithms to use when signing a JWT using this keyset.
     */
    readonly preferredSigningAlgorithms: readonly string[] = [
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
    if (!keys.length) throw new Error('Keyset is empty')

    const kids = new Set<string>()
    for (const key of keys) {
      if (kids.has(key.kid)) throw new Error(`Duplicate key id: ${key.kid}`)
      else kids.add(key.kid)
    }
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
  get publicJwks(): Jwks {
    return {
      keys: Array.from(this, extractPublicJwk).filter(isDefined),
    }
  }

  @cachedGetter
  get privateJwks(): Jwks {
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

    throw new TypeError(
      `Key not found ${search.kid || search.alg || '<unknown>'}`,
    )
  }

  *list(search: KeySearch): Generator<K> {
    for (const key of this) {
      if (search.kid && key.kid !== search.kid) continue
      if (search.use && key.use !== search.use) continue
      if (Array.isArray(search.alg)) {
        if (!search.alg.some((a) => key.algorithms.includes(a))) continue
      } else if (typeof search.alg === 'string') {
        if (!key.algorithms.includes(search.alg)) continue
      }

      yield key
    }
  }

  findSigningKey(search: Omit<KeySearch, 'use'>): [key: Key, alg: string] {
    const { kid, alg } = search
    const matchingKeys: Key[] = []

    for (const key of this.list({ kid, alg, use: 'sig' })) {
      // Not a signing key
      if (!key.canSign) continue

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

    throw new TypeError(`No singing key found for ${kid || alg || '<unknown>'}`)
  }

  [Symbol.iterator](): IterableIterator<K> {
    return this.keys.values()
  }

  async sign<P extends JwtPayload = JwtPayload>(
    { alg: searchAlg, kid: searchKid, ...header }: JwtSignHeader,
    payload: P | JwtPayloadGetter<P>,
  ): Promise<Jwt> {
    const [key, alg] = this.findSigningKey({ alg: searchAlg, kid: searchKid })

    const protectedHeader: JwtProtectedHeader = { ...header, alg, kid: key.kid }

    const keyObj = await key.signKeyObject()

    if (typeof payload === 'function') {
      payload = await payload(protectedHeader, key)
    }

    return new SignJWT(payload)
      .setProtectedHeader(protectedHeader)
      .sign(keyObj) as Promise<Jwt>
  }

  async verify<P>(
    token: Jwt,
    options?: JWTVerifyOptions,
  ): Promise<JwtVerifyResult<P>> {
    return jwtVerify<Simplify<P & JwtPayload>>(
      token,
      async ({ kid, alg }) => {
        // Ensure that the casting to JwtVerifyResult<P> is actually safe
        if (!kid || !alg) throw new TypeError('Missing "kid" or "alg"')

        const key = this.get({ use: 'sig', kid, alg })
        return key.verifyKeyObject()
      },
      options,
    ) as Promise<JwtVerifyResult<P>>
  }
}

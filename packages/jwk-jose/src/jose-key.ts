import {
  GenerateKeyPairOptions,
  JWK,
  JWTVerifyOptions,
  KeyLike,
  SignJWT,
  exportJWK,
  generateKeyPair,
  importJWK,
  importPKCS8,
  jwtVerify,
} from 'jose'

import {
  Jwk,
  Jwt,
  JwtHeader,
  JwtPayload,
  Key,
  VerifyOptions,
  VerifyPayload,
  VerifyResult,
  jwkValidator,
} from '@atproto/jwk'
import { either } from './util'

export type Importable = string | KeyLike | Jwk

export type { GenerateKeyPairOptions }

export class JoseKey extends Key {
  #keyObj?: KeyLike | Uint8Array

  protected async getKey() {
    return (this.#keyObj ||= await importJWK(this.jwk as JWK))
  }

  async createJwt(header: JwtHeader, payload: JwtPayload) {
    if (header.kid && header.kid !== this.kid) {
      throw new TypeError(
        `Invalid "kid" (${header.kid}) used to sign with key "${this.kid}"`,
      )
    }

    if (!header.alg || !this.algorithms.includes(header.alg)) {
      throw new TypeError(
        `Invalid "alg" (${header.alg}) used to sign with key "${this.kid}"`,
      )
    }

    const keyObj = await this.getKey()
    return new SignJWT(payload)
      .setProtectedHeader({ ...header, kid: this.kid })
      .sign(keyObj) as Promise<Jwt>
  }

  async verifyJwt<
    P extends VerifyPayload = JwtPayload,
    C extends string = string,
  >(token: Jwt, options?: VerifyOptions<C>): Promise<VerifyResult<P, C>> {
    const keyObj = await this.getKey()
    const result = await jwtVerify(token, keyObj, {
      ...options,
      algorithms: this.algorithms,
    } as JWTVerifyOptions)
    return result as VerifyResult<P, C>
  }

  static async generateKeyPair(
    allowedAlgos: string[] = ['ES256'],
    options?: GenerateKeyPairOptions,
  ) {
    const errors: unknown[] = []
    for (const alg of allowedAlgos) {
      try {
        return await generateKeyPair(alg, options)
      } catch (err) {
        errors.push(err)
      }
    }
    throw new AggregateError(errors, 'Failed to generate key pair')
  }

  static async generate(
    kid: string,
    allowedAlgos: string[] = ['ES256'],
    options?: GenerateKeyPairOptions,
  ) {
    const kp = await this.generateKeyPair(allowedAlgos, options)
    return this.fromImportable(kp.privateKey, kid)
  }

  static async fromImportable(
    input: Importable,
    kid?: string,
  ): Promise<JoseKey> {
    if (typeof input === 'string') {
      // PKCS8
      if (input.startsWith('-----')) {
        if (!kid) throw new TypeError('Missing "kid" for PKCS8 key')
        return this.fromPKCS8(input, kid)
      }

      // Jwk (string)
      if (input.startsWith('{')) {
        return this.fromJWK(input, kid)
      }

      throw new TypeError('Invalid input')
    }

    if (typeof input === 'object') {
      // Jwk
      if ('kty' in input || 'alg' in input) {
        return this.fromJWK(input, kid)
      }

      // KeyLike
      if (!kid) throw new TypeError('Missing "kid" for KeyLike key')
      return this.fromJWK(await exportJWK(input), kid)
    }

    throw new TypeError('Invalid input')
  }

  static async fromPKCS8(pem: string, kid: string): Promise<JoseKey> {
    const keyLike = await importPKCS8(pem, '', { extractable: true })
    return this.fromJWK(await exportJWK(keyLike), kid)
  }

  static async fromJWK(
    input: string | Record<string, unknown>,
    inputKid?: string,
  ): Promise<JoseKey> {
    const jwk = typeof input === 'string' ? JSON.parse(input) : input
    if (!jwk || typeof jwk !== 'object') throw new TypeError('Invalid JWK')

    const kid = either(jwk.kid, inputKid)
    const use = jwk.use || 'sig'

    return new JoseKey(jwkValidator.parse({ ...jwk, kid, use }))
  }
}

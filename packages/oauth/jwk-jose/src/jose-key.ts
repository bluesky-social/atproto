import {
  type GenerateKeyPairOptions,
  type GenerateKeyPairResult,
  type JWK,
  type JWTVerifyOptions,
  type KeyLike,
  SignJWT,
  errors,
  exportJWK,
  generateKeyPair,
  importJWK,
  importPKCS8,
  jwtVerify,
} from 'jose'
import {
  Jwk,
  JwkError,
  JwtCreateError,
  JwtHeader,
  JwtPayload,
  JwtVerifyError,
  Key,
  RequiredKey,
  SignedJwt,
  VerifyOptions,
  VerifyResult,
  jwkValidator,
  jwtHeaderSchema,
  jwtPayloadSchema,
} from '@atproto/jwk'
import { either } from './util'

const { JOSEError } = errors

export type Importable = string | KeyLike | Jwk

export type { GenerateKeyPairOptions, GenerateKeyPairResult }

export class JoseKey<J extends Jwk = Jwk> extends Key<J> {
  /**
   * Some runtimes (e.g. Bun) require an `alg` second argument to be set when
   * invoking `importJWK`. In order to be compatible with these runtimes, we
   * provide the following method to ensure the `alg` is always set. We also
   * take the opportunity to ensure that the `alg` is compatible with this key.
   */
  protected async getKeyObj(alg: string) {
    if (!this.algorithms.includes(alg)) {
      throw new JwkError(`Key cannot be used with algorithm "${alg}"`)
    }
    try {
      return await importJWK(this.jwk as JWK, alg)
    } catch (cause) {
      throw new JwkError('Failed to import JWK', undefined, { cause })
    }
  }

  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt> {
    try {
      const { kid } = header
      if (kid && kid !== this.kid) {
        throw new JwtCreateError(
          `Invalid "kid" (${kid}) used to sign with key "${this.kid}"`,
        )
      }

      const { alg } = header
      if (!alg) {
        throw new JwtCreateError('Missing "alg" in JWT header')
      }

      const keyObj = await this.getKeyObj(alg)
      const jwtBuilder = new SignJWT(payload).setProtectedHeader({
        ...header,
        alg,
        kid: this.kid,
      })

      const signedJwt = await jwtBuilder.sign(keyObj)

      return signedJwt as SignedJwt
    } catch (cause) {
      if (cause instanceof JOSEError) {
        throw new JwtCreateError(cause.message, cause.code, { cause })
      } else {
        throw JwtCreateError.from(cause)
      }
    }
  }

  async verifyJwt<C extends string = never>(
    token: SignedJwt,
    options?: VerifyOptions<C>,
  ): Promise<VerifyResult<C>> {
    try {
      const result = await jwtVerify(
        token,
        async ({ alg }) => this.getKeyObj(alg),
        { ...options, algorithms: this.algorithms } as JWTVerifyOptions,
      )

      // @NOTE if all tokens are signed exclusively through createJwt(), then
      // there should be no need to parse the payload and headers here. But
      // since the JWT could have been signed with the same key from somewhere
      // else, let's parse it to ensure the integrity (and type safety) of the
      // data.
      const headerParsed = jwtHeaderSchema.safeParse(result.protectedHeader)
      if (!headerParsed.success) {
        throw new JwtVerifyError('Invalid JWT header', undefined, {
          cause: headerParsed.error,
        })
      }

      const payloadParsed = jwtPayloadSchema.safeParse(result.payload)
      if (!payloadParsed.success) {
        throw new JwtVerifyError('Invalid JWT payload', undefined, {
          cause: payloadParsed.error,
        })
      }

      return {
        protectedHeader: headerParsed.data,
        // "requiredClaims" enforced by jwtVerify()
        payload: payloadParsed.data as RequiredKey<JwtPayload, C>,
      }
    } catch (cause) {
      if (cause instanceof JOSEError) {
        throw new JwtVerifyError(cause.message, cause.code, { cause })
      } else {
        throw JwtVerifyError.from(cause)
      }
    }
  }

  static async generateKeyPair(
    allowedAlgos: readonly string[] = ['ES256'],
    options?: GenerateKeyPairOptions,
  ) {
    if (!allowedAlgos.length) {
      throw new JwkError('No algorithms provided for key generation')
    }

    const errors: unknown[] = []
    for (const alg of allowedAlgos) {
      try {
        return await generateKeyPair(alg, options)
      } catch (err) {
        errors.push(err)
      }
    }

    throw new JwkError('Failed to generate key pair', undefined, {
      cause: new AggregateError(errors, 'None of the algorithms worked'),
    })
  }

  static async generate(
    allowedAlgos: string[] = ['ES256'],
    kid?: string,
    options?: Omit<GenerateKeyPairOptions, 'extractable'>,
  ) {
    const kp = await this.generateKeyPair(allowedAlgos, {
      ...options,
      extractable: true,
    })
    return this.fromImportable(kp.privateKey, kid)
  }

  static async fromImportable(
    input: Importable,
    kid?: string,
  ): Promise<JoseKey> {
    if (typeof input === 'string') {
      // PKCS8
      if (input.startsWith('-----')) {
        // The "alg" is only needed in WebCrypto (NodeJS will be fine)
        return this.fromPKCS8(input, '', kid)
      }

      // Jwk (string)
      if (input.startsWith('{')) {
        return this.fromJWK(input, kid)
      }

      throw new JwkError('Invalid input')
    }

    if (typeof input === 'object') {
      // Jwk
      if ('kty' in input || 'alg' in input) {
        return this.fromJWK(input, kid)
      }

      // KeyLike
      return this.fromKeyLike(input, kid)
    }

    throw new JwkError('Invalid input')
  }

  /**
   * @see {@link exportJWK}
   */
  static async fromKeyLike(
    keyLike: KeyLike | Uint8Array,
    kid?: string,
    alg?: string,
  ): Promise<JoseKey> {
    const jwk = await exportJWK(keyLike)
    if (alg) {
      if (!jwk.alg) jwk.alg = alg
      else if (jwk.alg !== alg) throw new JwkError('Invalid "alg" in JWK')
    }
    return this.fromJWK(jwk, kid)
  }

  /**
   * @see {@link importPKCS8}
   */
  static async fromPKCS8(
    pem: string,
    alg: string,
    kid?: string,
  ): Promise<JoseKey> {
    const keyLike = await importPKCS8(pem, alg, { extractable: true })
    return this.fromKeyLike(keyLike, kid)
  }

  static async fromJWK(
    input: string | Record<string, unknown>,
    inputKid?: string,
  ): Promise<JoseKey> {
    const jwk = typeof input === 'string' ? JSON.parse(input) : input
    if (!jwk || typeof jwk !== 'object') throw new JwkError('Invalid JWK')

    const kid = either(jwk.kid, inputKid)
    const use = jwk.use || 'sig'

    return new JoseKey(jwkValidator.parse({ ...jwk, kid, use }))
  }
}

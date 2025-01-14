import { jwkAlgorithms } from './alg.js'
import { JwkError } from './errors.js'
import { Jwk, jwkSchema } from './jwk.js'
import { VerifyOptions, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { cachedGetter } from './util.js'

const jwkSchemaReadonly = jwkSchema.readonly()

export abstract class Key<J extends Jwk = Jwk> {
  constructor(protected readonly jwk: Readonly<J>) {
    // A key should always be used either for signing or encryption.
    if (!jwk.use) throw new JwkError('Missing "use" Parameter value')
  }

  get isPrivate(): boolean {
    const { jwk } = this
    if ('d' in jwk && jwk.d !== undefined) return true
    if ('k' in jwk && jwk.k !== undefined) return true
    return false
  }

  get isSymetric(): boolean {
    const { jwk } = this
    if ('k' in jwk && jwk.k !== undefined) return true
    return false
  }

  get privateJwk(): Readonly<J> | undefined {
    return this.isPrivate ? this.jwk : undefined
  }

  @cachedGetter
  get publicJwk():
    | Readonly<Exclude<J, { kty: 'oct' }> & { d?: never }>
    | undefined {
    if (this.isSymetric) return undefined

    return jwkSchemaReadonly.parse({
      ...this.jwk,
      d: undefined,
      k: undefined,
    }) as Exclude<J, { kty: 'oct' }> & { d?: never }
  }

  @cachedGetter
  get bareJwk(): Readonly<Jwk> | undefined {
    if (this.isSymetric) return undefined
    const { kty, crv, e, n, x, y } = this.jwk as any
    return jwkSchemaReadonly.parse({ crv, e, kty, n, x, y })
  }

  get use() {
    return this.jwk.use!
  }

  /**
   * The (forced) algorithm to use. If not provided, the key will be usable with
   * any of the algorithms in {@link algorithms}.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7518#section-3.1 | "alg" (Algorithm) Header Parameter Values for JWS}
   */
  get alg() {
    return this.jwk.alg
  }

  get kid() {
    return this.jwk.kid
  }

  get crv() {
    return (this.jwk as { crv: undefined } | Extract<J, { crv: unknown }>).crv
  }

  /**
   * All the algorithms that this key can be used with. If `alg` is provided,
   * this set will only contain that algorithm.
   */
  @cachedGetter
  get algorithms(): readonly string[] {
    return Object.freeze(Array.from(jwkAlgorithms(this.jwk)))
  }

  /**
   * Create a signed JWT
   */
  abstract createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt>

  /**
   * Verify the signature, headers and payload of a JWT
   *
   * @throws {JwtVerifyError} if the JWT is invalid
   */
  abstract verifyJwt<C extends string = never>(
    token: SignedJwt,
    options?: VerifyOptions<C>,
  ): Promise<VerifyResult<C>>
}

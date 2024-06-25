import { jwkAlgorithms } from './alg.js'
import { JwkError } from './errors.js'
import { Jwk, jwkSchema } from './jwk.js'
import { VerifyOptions, VerifyPayload, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { cachedGetter } from './util.js'

export abstract class Key {
  constructor(protected readonly jwk: Readonly<Jwk>) {
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

  get privateJwk(): Jwk | undefined {
    return this.isPrivate ? this.jwk : undefined
  }

  @cachedGetter
  get publicJwk(): Jwk | undefined {
    if (this.isSymetric) return undefined
    if (this.isPrivate) {
      const { d: _, ...jwk } = this.jwk as any
      return jwk
    }
    return this.jwk
  }

  @cachedGetter
  get bareJwk(): Jwk | undefined {
    if (this.isSymetric) return undefined
    const { kty, crv, e, n, x, y } = this.jwk as any
    return jwkSchema.parse({ crv, e, kty, n, x, y })
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
    return (this.jwk as { crv: undefined } | Extract<Jwk, { crv: unknown }>).crv
  }

  /**
   * All the algorithms that this key can be used with. If `alg` is provided,
   * this set will only contain that algorithm.
   */
  @cachedGetter
  get algorithms(): readonly string[] {
    return Array.from(jwkAlgorithms(this.jwk))
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
  abstract verifyJwt<
    P extends VerifyPayload = JwtPayload,
    C extends string = string,
  >(token: SignedJwt, options?: VerifyOptions<C>): Promise<VerifyResult<P, C>>
}

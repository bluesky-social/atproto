import { jwkAlgorithms } from './alg.js'
import {
  Jwk,
  KeyUsage,
  isEncKeyUsage,
  isPrivateJwk,
  isPrivateKeyUsage,
  isPublicKeyUsage,
  isSharedSecretJwk,
  isSigKeyUsage,
  jwkSchema,
} from './jwk.js'
import { VerifyOptions, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { cachedGetter } from './util.js'

const jwkSchemaReadonly = jwkSchema.readonly()

export type KeyMatchOptions = {
  usage?: KeyUsage
  kid?: string | string[]
  alg?: string | string[]
}

export abstract class Key<J extends Jwk = Jwk> {
  constructor(protected readonly jwk: Readonly<J>) {}

  @cachedGetter
  get isPrivate(): boolean {
    return isPrivateJwk(this.jwk)
  }

  @cachedGetter
  get isSymetric(): boolean {
    return isSharedSecretJwk(this.jwk)
  }

  get privateJwk(): Readonly<J> | undefined {
    return this.isPrivate ? this.jwk : undefined
  }

  @cachedGetter
  get publicJwk():
    | Readonly<Exclude<J, { kty: 'oct' }> & { d?: never }>
    | undefined {
    if (this.isSymetric) return undefined

    // Translate private ops into public ops
    const newOps = this.jwk.key_ops?.filter(isPublicKeyUsage)

    // No possible ops
    if (newOps?.length === 0) return undefined

    return jwkSchemaReadonly.parse({
      ...this.jwk,
      d: undefined,
      k: undefined,
      key_ops: newOps,
    }) as Exclude<J, { kty: 'oct' }> & { d?: never }
  }

  @cachedGetter
  get bareJwk(): Readonly<Jwk> | undefined {
    if (this.isSymetric) return undefined
    const { kty, crv, e, n, x, y } = this.jwk as any
    return jwkSchemaReadonly.parse({ crv, e, kty, n, x, y })
  }

  get use(): 'sig' | 'enc' | undefined {
    return this.jwk.use
  }

  get ops(): readonly KeyUsage[] | undefined {
    return this.jwk.key_ops
  }

  /**
   * The (forced) algorithm to use. If not provided, the key will be usable with
   * any of the algorithms in {@link algorithms}.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7518#section-3.1 | "alg" (Algorithm) Header Parameter Values for JWS}
   */
  get alg(): string | undefined {
    return this.jwk.alg
  }

  get kid(): string | undefined {
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

  matches(opts: KeyMatchOptions): boolean {
    if (opts.kid != null) {
      const matches = Array.isArray(opts.kid)
        ? this.kid != null && opts.kid.includes(this.kid)
        : opts.kid === this.kid
      if (!matches) return false
    }

    if (opts.alg != null) {
      const matches = Array.isArray(opts.alg)
        ? opts.alg.some((a) => this.algorithms.includes(a))
        : this.algorithms.includes(opts.alg)
      if (!matches) return false
    }

    if (opts.usage) {
      const matchesOps = this.ops == null || this.ops.includes(opts.usage)
      if (!matchesOps) return false

      const matchesUse =
        this.use == null ||
        (this.use === 'sig' && isSigKeyUsage(opts.usage)) ||
        (this.use === 'enc' && isEncKeyUsage(opts.usage))
      if (!matchesUse) return false

      // @NOTE This is only relevant when "key_ops" and "use" are undefined
      const matchesKeyType = this.isPrivate || isPublicKeyUsage(opts.usage)
      if (!matchesKeyType) return false
    }

    return true
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

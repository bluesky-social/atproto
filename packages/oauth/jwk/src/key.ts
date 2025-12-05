import { jwkAlgorithms } from './alg.js'
import {
  Jwk,
  KeyUsage,
  PUBLIC_KEY_USAGE,
  PrivateJwk,
  PublicJwk,
  PublicKeyUsage,
  hasSharedSecretJwk,
  isEncKeyUsage,
  isPrivateJwk,
  isPublicKeyUsage,
  isSigKeyUsage,
  jwkPubSchema,
  jwkSchema,
} from './jwk.js'
import { VerifyOptions, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { cachedGetter } from './util.js'

export type KeyMatchOptions = {
  usage?: KeyUsage
  kid?: string | string[]
  alg?: string | string[]
}

export type ActivityCheckOptions = {
  allowRevoked?: boolean
  clockTolerance?: number
  currentDate?: Date
}

export abstract class Key<J extends Jwk = Jwk> {
  constructor(readonly jwk: Readonly<J>) {}

  @cachedGetter
  get isPrivate(): boolean {
    return isPrivateJwk(this.jwk)
  }

  @cachedGetter
  get isSymetric(): boolean {
    return hasSharedSecretJwk(this.jwk)
  }

  get privateJwk(): Readonly<PrivateJwk> | undefined {
    if (!this.isPrivate) return undefined

    return this.jwk as Readonly<PrivateJwk>
  }

  @cachedGetter
  get publicJwk(): Readonly<PublicJwk> | undefined {
    if (this.isSymetric) return undefined
    if (!this.isPrivate) return this.jwk as Readonly<PublicJwk>

    const validated = jwkPubSchema.safeParse({
      ...this.jwk,
      d: undefined,
      k: undefined,
      use: undefined,
      key_ops: buildPublicKeyOps(this.keyOps) ?? PUBLIC_KEY_USAGE,
    })

    // One reason why the parsing might fail is if key_ops is empty. This check
    // also allows to future proof the code (e.g if another type of private key
    // is added that uses a different property than "d" or "k" to store its
    // private value).
    if (!validated.success) return undefined

    return Object.freeze(validated.data)
  }

  @cachedGetter
  get bareJwk(): Readonly<Jwk> | undefined {
    if (this.isSymetric) return undefined
    const { kty, crv, e, n, x, y } = this.jwk as any
    return Object.freeze(jwkSchema.parse({ crv, e, kty, n, x, y }))
  }

  /**
   * @note Only defined on public keys
   */
  get use(): 'sig' | 'enc' | undefined {
    return this.jwk.use
  }

  get keyOps(): readonly KeyUsage[] | undefined {
    return this.jwk.key_ops
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

  get isRevoked() {
    return this.jwk.revoked != null
  }

  isActive(options?: ActivityCheckOptions) {
    if (!options?.allowRevoked && this.isRevoked) return false

    const tolerance = options?.clockTolerance ?? 0
    if (tolerance !== Infinity) {
      const now = options?.currentDate?.getTime() ?? Date.now()
      const { exp, nbf } = this.jwk

      if (nbf != null && !(now >= nbf * 1e3 - tolerance)) return false
      if (exp != null && !(now < exp * 1e3 + tolerance)) return false
    }

    return true
  }

  matches(opts: KeyMatchOptions): boolean {
    if (opts.kid != null) {
      const matchesKid = Array.isArray(opts.kid)
        ? this.kid != null && opts.kid.includes(this.kid)
        : this.kid === opts.kid
      if (!matchesKid) return false
    }

    if (opts.alg != null) {
      const matchesAlg = Array.isArray(opts.alg)
        ? opts.alg.some((a) => this.algorithms.includes(a))
        : this.algorithms.includes(opts.alg)
      if (!matchesAlg) return false
    }

    if (opts.usage != null) {
      const matchesOps =
        this.keyOps == null ||
        this.keyOps.includes(opts.usage) ||
        // @NOTE Because this.jwk represents the private key (typically used for
        // private operations), the public counterpart operations are allowed.
        (opts.usage === 'verify' && this.keyOps.includes('sign')) ||
        (opts.usage === 'encrypt' && this.keyOps.includes('decrypt')) ||
        (opts.usage === 'wrapKey' && this.keyOps.includes('unwrapKey'))
      if (!matchesOps) return false

      const matchesUse =
        this.use == null ||
        (this.use === 'sig' && isSigKeyUsage(opts.usage)) ||
        (this.use === 'enc' && isEncKeyUsage(opts.usage))
      if (!matchesUse) return false

      // @NOTE This is only relevant when "key_ops" and "use" are undefined.
      // This line also ensures that when "opts.usage" is a private key usage
      // (e.g. "sign"), the key is indeed a private key.
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

function buildPublicKeyOps(
  keyUsages?: readonly KeyUsage[],
): PublicKeyUsage[] | undefined {
  if (keyUsages == null) return undefined

  // https://datatracker.ietf.org/doc/html/rfc7517#section-4.3
  // > Duplicate key operation values MUST NOT be present in the array.
  const publicOps = new Set(keyUsages.filter(isPublicKeyUsage))

  // @NOTE Translating private key usage into public key usage
  if (keyUsages.includes('sign')) publicOps.add('verify')
  if (keyUsages.includes('decrypt')) publicOps.add('encrypt')
  if (keyUsages.includes('unwrapKey')) publicOps.add('wrapKey')

  return Array.from(publicOps)
}

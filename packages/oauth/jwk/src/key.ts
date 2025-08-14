import { jwkAlgorithms } from './alg.js'
import {
  Jwk,
  KeyUsage,
  isPrivateJwk,
  isSharedSecretJwk,
  jwkSchema,
} from './jwk.js'
import { VerifyOptions, VerifyResult } from './jwt-verify.js'
import { JwtHeader, JwtPayload, SignedJwt } from './jwt.js'
import { cachedGetter } from './util.js'

const jwkSchemaReadonly = jwkSchema.readonly()

function isPublicKeyUsage(usage: KeyUsage): boolean {
  return usage === 'verify' || usage === 'decrypt'
}

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
    const publicOps = this.jwk.key_ops
      ? Array.from(
          new Set(
            this.jwk.key_ops
              .map((op) =>
                op === 'sign' ? 'verify' : op === 'encrypt' ? 'decrypt' : op,
              )
              .filter(isPublicKeyUsage),
          ),
        )
      : undefined

    // No possible ops
    if (publicOps?.length === 0) return undefined

    return jwkSchemaReadonly.parse({
      ...this.jwk,
      d: undefined,
      k: undefined,
      key_ops: publicOps,
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

  matches(opts: KeyMatchOptions) {
    // Optimization: Empty string or empty array will not match any key
    if (opts.alg?.length === 0) return false
    if (opts.kid?.length === 0) return false

    if (opts.usage) {
      if (this.ops) {
        if (opts.usage === 'verify' && this.ops.includes('sign')) {
          // allowed
        } else if (opts.usage === 'decrypt' && this.ops.includes('encrypt')) {
          // allowed
        } else if (!this.ops.includes(opts.usage)) {
          return false // no match
        }
      }

      if (this.use) {
        if (opts.usage === 'verify' && this.use === 'sig') {
          // allowed
        } else if (opts.usage === 'encrypt' && this.use === 'enc') {
          // allowed
        } else {
          return false // no match
        }
      }

      if (opts.usage === 'sign' || opts.usage === 'encrypt') {
        if (!this.isPrivate) return false
      }
    }

    if (Array.isArray(opts.kid)) {
      if (!this.kid) return false
      if (!opts.kid.includes(this.kid)) return false
    } else if (opts.kid != null) {
      if (!this.kid) return false
      if (this.kid !== opts.kid) return false
    }

    if (Array.isArray(opts.alg)) {
      if (!opts.alg.some((a) => this.algorithms.includes(a))) return false
    } else if (typeof opts.alg === 'string') {
      if (!this.algorithms.includes(opts.alg)) return false
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

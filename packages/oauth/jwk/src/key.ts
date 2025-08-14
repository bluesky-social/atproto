import { jwkAlgorithms } from './alg.js'
import { JwkError } from './errors.js'
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
  constructor(protected readonly jwk: Readonly<J>) {
    const { use, key_ops } = jwk

    if (use && key_ops) {
      throw new JwkError(`JWK cannot have both "use" and "key_ops"`)
    }

    if (use && use !== 'sig') {
      throw new JwkError(`Unsupported JWK use "${use}"`)
    }

    if (use && isPrivateJwk(jwk)) {
      throw new JwkError(`JWK with "use" cannot be a private key`)
    }

    if (key_ops && !key_ops.includes('sign') && !key_ops.includes('verify')) {
      throw new JwkError(`Invalid key_ops "${key_ops}" for "sig" use`)
    }
  }

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

    return jwkSchemaReadonly.parse({
      ...this.jwk,
      d: undefined,
      k: undefined,
      key_ops: this.jwk.key_ops?.filter(isPublicKeyUsage),
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

  matches(options: KeyMatchOptions) {
    // Optimization: Empty string or empty array will not match any key
    if (options.alg?.length === 0) return false
    if (options.kid?.length === 0) return false

    if (options.usage) {
      if (this.ops && !this.ops.includes(options.usage)) {
        return false
      }

      if (this.use) {
        // "this" should be a public key

        if (options.usage === 'verify' && this.use === 'sig') {
          // ok
        } else if (options.usage === 'encrypt' && this.use === 'enc') {
          // ok
        } else {
          return false // no match
        }
      }

      if (options.usage === 'sign' || options.usage === 'encrypt') {
        if (!this.isPrivate) return false
      }
    }

    if (Array.isArray(options.kid)) {
      if (!this.kid) return false
      if (!options.kid.includes(this.kid)) return false
    } else if (options.kid != null) {
      if (!this.kid) return false
      if (this.kid !== options.kid) return false
    }

    if (Array.isArray(options.alg)) {
      if (!options.alg.some((a) => this.algorithms.includes(a))) return false
    } else if (typeof options.alg === 'string') {
      if (!this.algorithms.includes(options.alg)) return false
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

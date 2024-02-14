import { JWK, importJWK } from 'jose'

import { jwkAlgorithms } from './alg.js'
import { Jwk, jwkSchema } from './jwk.js'
import { KeyLike } from './types.js'
import { cachedGetter, either } from './util.js'

export class Key {
  readonly privateJwk?: Jwk
  readonly privateKey?: KeyLike

  readonly publicJwk?: Jwk
  readonly publicKey?: KeyLike

  constructor({
    privateJwk,
    privateKey,
    publicJwk,
    publicKey,
  }:
    | {
        privateJwk: Jwk
        privateKey?: KeyLike
        publicJwk?: Jwk
        publicKey?: KeyLike
      }
    | {
        privateJwk?: Jwk
        privateKey?: KeyLike
        publicJwk: Jwk
        publicKey?: KeyLike
      }) {
    if (!privateJwk && !publicJwk)
      throw new TypeError('At least one of privateJwk or publicJwk is required')
    if (privateKey && !privateJwk)
      throw new TypeError('privateKey must be used with privateJwk')
    if (publicKey && !publicJwk)
      throw new TypeError('publicKey must be used with publicJwk')

    this.privateJwk = privateJwk
    this.privateKey = privateKey

    this.publicJwk = publicJwk
    this.publicKey = publicKey
  }

  /**
   * A key should always be used either for signing or encryption.
   */
  get use() {
    const use = either(this.privateJwk?.use, this.publicJwk?.use)
    if (!use) throw new TypeError('Missing "use" Parameter value')
    return use
  }

  /**
   * The (forced) algorithm to use. If not provided, the key will be usable with
   * any of the algorithms in {@link algorithms}.
   */
  get alg() {
    return either(this.privateJwk?.alg, this.publicJwk?.alg)
  }

  /**
   * The key ID.
   */
  get kid() {
    const kid = either(this.privateJwk?.kid, this.publicJwk?.kid)
    if (!kid) throw new TypeError('Missing "kid" Parameter value')
    return kid
  }

  get crv() {
    return either(
      (this.privateJwk as undefined | Extract<Jwk, { crv: unknown }>)?.crv,
      (this.publicJwk as undefined | Extract<Jwk, { crv: unknown }>)?.crv,
    )
  }

  get canVerify() {
    return this.use === 'sig'
  }

  get canSign() {
    return this.use === 'sig' && this.privateJwk != null
  }

  /**
   * The "bare" public jwk (without `kid`, `use` and `alg`), to use inside a
   * "cnf" JWT header.
   */
  @cachedGetter
  get bareJwk(): Jwk {
    const { kty, crv, e, n, x, y } = (this.publicJwk || this.privateJwk) as any
    return jwkSchema.parse({ crv, e, kty, n, x, y })
  }

  /**
   * All the algorithms that this key can be used with. If `alg` is provided,
   * this set will only contain that algorithm.
   */
  @cachedGetter
  get algorithms(): readonly string[] {
    const jwk = this.privateJwk || this.publicJwk
    return Array.from(jwk ? jwkAlgorithms(jwk) : [])
  }

  signKeyObject() {
    if (!this.privateJwk) throw new TypeError('Not a private key')
    return this.privateKey || importJWK(this.privateJwk as JWK)
  }

  verifyKeyObject() {
    return (
      // Use the KeyLike object if it's available
      this.publicKey ||
      this.privateKey ||
      // Fallback to the JWK
      importJWK((this.privateJwk || this.publicJwk)! as JWK)
    )
  }
}

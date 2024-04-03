import { Jwk, jwkSchema } from '@atproto/jwk'
import { JoseKey } from '@atproto/jwk-jose'
// XXX TODO: remove "./db.ts" file
// import { loadCryptoKeyPair } from './db.js'
import {
  generateKeypair,
  fromSubtleAlgorithm,
  isSignatureKeyPair,
} from './util.js'

export class WebcryptoKey extends JoseKey {
  // static async fromIndexedDB(kid: string, allowedAlgos: string[] = ['ES384']) {
  //   const cryptoKeyPair = await loadCryptoKeyPair(kid, allowedAlgos)
  //   return this.fromKeypair(kid, cryptoKeyPair)
  // }

  static async generate(
    kid: string = crypto.randomUUID(),
    allowedAlgos: string[] = ['ES384'],
    exportable = false,
  ) {
    const cryptoKeyPair = await generateKeypair(allowedAlgos, exportable)
    return this.fromKeypair(kid, cryptoKeyPair)
  }

  static async fromKeypair(kid: string, cryptoKeyPair: CryptoKeyPair) {
    if (!isSignatureKeyPair(cryptoKeyPair)) {
      throw new TypeError('CryptoKeyPair must be compatible with sign/verify')
    }

    // https://datatracker.ietf.org/doc/html/rfc7517
    // > The "use" and "key_ops" JWK members SHOULD NOT be used together; [...]
    // > Applications should specify which of these members they use.

    const { key_ops: _, ...jwk } = await crypto.subtle.exportKey(
      'jwk',
      cryptoKeyPair.privateKey.extractable
        ? cryptoKeyPair.privateKey
        : cryptoKeyPair.publicKey,
    )

    const use = jwk.use ?? 'sig'
    const alg =
      jwk.alg ?? fromSubtleAlgorithm(cryptoKeyPair.privateKey.algorithm)

    if (use !== 'sig') {
      throw new TypeError('Unsupported JWK use')
    }

    return new WebcryptoKey(
      jwkSchema.parse({ ...jwk, use, kid, alg }),
      cryptoKeyPair,
    )
  }

  constructor(
    jwk: Jwk,
    readonly cryptoKeyPair: CryptoKeyPair,
  ) {
    super(jwk)
  }

  get isPrivate() {
    return true
  }

  get privateJwk(): Jwk | undefined {
    if (super.isPrivate) return this.jwk
    throw new Error('Private Webcrypto Key not exportable')
  }

  protected async getKey() {
    return this.cryptoKeyPair.privateKey
  }
}

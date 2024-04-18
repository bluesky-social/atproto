import { Jwk, jwkSchema } from '@atproto/jwk'
import { GenerateKeyPairOptions, JoseKey } from '@atproto/jwk-jose'

import { fromSubtleAlgorithm, isSignatureKeyPair } from './util.js'

export class WebcryptoKey extends JoseKey {
  // We need to override the static method generate from JoseKey because
  // the browser needs both the private and public keys
  static override async generate(
    kid: string = crypto.randomUUID(),
    allowedAlgos: string[] = ['ES256'],
    options?: GenerateKeyPairOptions,
  ) {
    const { privateKey, publicKey } = await this.generateKeyPair(
      allowedAlgos,
      options,
    )
    // Type safety only: in the browser, "jose" generates a CryptoKeyPair
    if (
      !(privateKey instanceof CryptoKey) ||
      !(publicKey instanceof CryptoKey)
    ) {
      throw new TypeError('Invalid CryptoKeyPair')
    }
    return this.fromKeypair(kid, { privateKey, publicKey })
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

  protected override async getKey() {
    return this.cryptoKeyPair.privateKey
  }
}

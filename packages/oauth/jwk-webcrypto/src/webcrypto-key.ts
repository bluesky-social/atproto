import { Jwk, JwkError, jwkSchema } from '@atproto/jwk'
import { GenerateKeyPairOptions, JoseKey } from '@atproto/jwk-jose'
import { fromSubtleAlgorithm, isCryptoKeyPair } from './util.js'

export class WebcryptoKey<J extends Jwk = Jwk> extends JoseKey<J> {
  // We need to override the static method generate from JoseKey because
  // the browser needs both the private and public keys
  static override async generate(
    allowedAlgos: string[] = ['ES256'],
    kid: string = crypto.randomUUID(),
    options?: GenerateKeyPairOptions,
  ): Promise<WebcryptoKey> {
    const keyPair = await this.generateKeyPair(allowedAlgos, options)

    // Type safety only: in the browser, 'jose' always generates a CryptoKeyPair
    if (!isCryptoKeyPair(keyPair)) {
      throw new TypeError('Invalid CryptoKeyPair')
    }

    return this.fromKeypair(keyPair, kid)
  }

  static async fromKeypair(
    cryptoKeyPair: CryptoKeyPair,
    kid?: string,
  ): Promise<WebcryptoKey> {
    const {
      alg = fromSubtleAlgorithm(cryptoKeyPair.privateKey.algorithm),
      ...jwk
    } = await crypto.subtle.exportKey(
      'jwk',
      cryptoKeyPair.privateKey.extractable
        ? cryptoKeyPair.privateKey
        : cryptoKeyPair.publicKey,
    )

    return new WebcryptoKey<Jwk>(
      jwkSchema.parse({ ...jwk, kid, alg }),
      cryptoKeyPair,
    )
  }

  constructor(
    jwk: Readonly<J>,
    readonly cryptoKeyPair: CryptoKeyPair,
  ) {
    // Webcrypto keys are bound to a single algorithm
    if (!jwk.alg) throw new JwkError('JWK "alg" is required for Webcrypto keys')

    super(jwk)
  }

  get isPrivate() {
    return true
  }

  protected override async getKeyObj(alg: string) {
    if (this.jwk.alg !== alg) {
      throw new JwkError(`Key cannot be used with algorithm "${alg}"`)
    }
    return this.cryptoKeyPair.privateKey
  }
}

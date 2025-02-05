import { z } from 'zod'
import { JwkError, jwkSchema } from '@atproto/jwk'
import { GenerateKeyPairOptions, JoseKey } from '@atproto/jwk-jose'
import { fromSubtleAlgorithm, isCryptoKeyPair } from './util.js'

// Webcrypto keys are bound to a single algorithm
export const jwkWithAlgSchema = z.intersection(
  jwkSchema,
  z.object({ alg: z.string() }),
)

export type JwkWithAlg = z.infer<typeof jwkWithAlgSchema>

export class WebcryptoKey<
  J extends JwkWithAlg = JwkWithAlg,
> extends JoseKey<J> {
  // We need to override the static method generate from JoseKey because
  // the browser needs both the private and public keys
  static override async generate(
    allowedAlgos: string[] = ['ES256'],
    kid: string = crypto.randomUUID(),
    options?: GenerateKeyPairOptions,
  ) {
    const keyPair = await this.generateKeyPair(allowedAlgos, options)

    // Type safety only: in the browser, 'jose' always generates a CryptoKeyPair
    if (!isCryptoKeyPair(keyPair)) {
      throw new TypeError('Invalid CryptoKeyPair')
    }

    return this.fromKeypair(keyPair, kid)
  }

  static async fromKeypair(cryptoKeyPair: CryptoKeyPair, kid?: string) {
    // https://datatracker.ietf.org/doc/html/rfc7517
    // > The "use" and "key_ops" JWK members SHOULD NOT be used together; [...]
    // > Applications should specify which of these members they use.

    const {
      key_ops,
      use,
      alg = fromSubtleAlgorithm(cryptoKeyPair.privateKey.algorithm),
      ...jwk
    } = await crypto.subtle.exportKey(
      'jwk',
      cryptoKeyPair.privateKey.extractable
        ? cryptoKeyPair.privateKey
        : cryptoKeyPair.publicKey,
    )

    if (use && use !== 'sig') {
      throw new TypeError(`Unsupported JWK use "${use}"`)
    }

    if (key_ops && !key_ops.some((o) => o === 'sign' || o === 'verify')) {
      // Make sure that "key_ops", if present, is compatible with "use"
      throw new TypeError(`Invalid key_ops "${key_ops}" for "sig" use`)
    }

    return new WebcryptoKey(
      jwkWithAlgSchema.parse({ ...jwk, kid, alg, use: 'sig' }),
      cryptoKeyPair,
    )
  }

  constructor(
    jwk: Readonly<J>,
    readonly cryptoKeyPair: CryptoKeyPair,
  ) {
    super(jwk)
  }

  get isPrivate() {
    return true
  }

  get privateJwk(): Readonly<J> | undefined {
    if (super.isPrivate) return this.jwk
    throw new Error('Private Webcrypto Key not exportable')
  }

  protected override async getKeyObj(alg: string) {
    if (this.jwk.alg !== alg) {
      throw new JwkError(`Key cannot be used with algorithm "${alg}"`)
    }
    return this.cryptoKeyPair.privateKey
  }
}

import { Key } from '@atproto/jwk'
import { JoseKey } from '@atproto/jwk-jose'
import { CryptoImplementation, DigestAlgorithm } from '@atproto/oauth-client'

export class CryptoSubtle implements CryptoImplementation {
  constructor(private crypto: Crypto = globalThis.crypto) {
    if (!crypto?.subtle) {
      throw new Error('Crypto with CryptoSubtle is required')
    }
  }

  async createKey(algs: string[]): Promise<Key> {
    const algorithm = algs
      .map((alg): RsaHashedKeyGenParams | EcKeyGenParams | null => {
        if (alg.startsWith('ES') && alg.endsWith('K')) {
          return { name: 'ECDSA', namedCurve: `P-${alg.slice(2, -1)}` }
        }
        if (alg.startsWith('ES')) {
          return { name: 'ECDSA', namedCurve: `P-${alg.slice(2)}` }
        }
        if (alg.startsWith('RS')) {
          return {
            name: 'RSASSA-PKCS1-v1_5',
            hash: { name: `SHA-${alg.slice(2)}` },
            modulusLength: parseInt(alg.slice(2), 10),
            publicExponent: new Uint8Array([1, 0, 1]),
          }
        }
        return null
      })
      .find((v) => v !== null)

    if (!algorithm) throw new Error('Unsupported algorithm')

    // TODO: The DPoP key should not be exportable
    const key = await this.crypto.subtle.generateKey(algorithm, true, [
      'sign',
      'verify',
    ])

    return JoseKey.fromImportable(key as any)
  }

  getRandomValues(byteLength: number): Uint8Array {
    const bytes = new Uint8Array(byteLength)
    this.crypto.getRandomValues(bytes)
    return bytes
  }

  async digest(
    bytes: Uint8Array,
    algorithm: DigestAlgorithm,
  ): Promise<Uint8Array> {
    const buffer = await this.crypto.subtle.digest(
      digestAlgorithmToSubtle(algorithm),
      bytes,
    )
    return new Uint8Array(buffer)
  }
}

function digestAlgorithmToSubtle({
  name,
}: DigestAlgorithm): AlgorithmIdentifier {
  switch (name) {
    case 'sha256':
    case 'sha384':
    case 'sha512':
      return `SHA-${name.slice(-3)}`
    default:
      throw new Error(`Unknown hash algorithm ${name}`)
  }
}

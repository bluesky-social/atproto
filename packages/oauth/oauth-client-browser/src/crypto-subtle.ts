import { WebcryptoKey } from '@atproto/jwk-webcrypto'
import {
  Key,
  CryptoImplementation,
  DigestAlgorithm,
} from '@atproto/oauth-client'

export class CryptoSubtle implements CryptoImplementation {
  constructor(private crypto: Crypto = globalThis.crypto) {
    if (!crypto?.subtle) {
      throw new Error(
        'Crypto with CryptoSubtle is required. If running in a browser, make sure the current page is loaded over HTTPS.',
      )
    }
  }

  async createKey(algs: string[]): Promise<Key> {
    return WebcryptoKey.generate(algs)
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
      throw new TypeError(`Unknown hash algorithm ${name}`)
  }
}

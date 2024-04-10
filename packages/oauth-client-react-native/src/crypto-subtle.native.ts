import { WebcryptoKey } from '@atproto/jwk-react-native-crypto'
import {
  Key,
  CryptoImplementation,
  DigestAlgorithm,
} from '@atproto/oauth-client'
import crypto from 'react-native-quick-crypto'

export class CryptoSubtle implements CryptoImplementation {
  // @ts-ignore
  constructor(private crypto: Crypto = globalThis.crypto) {}

  async createKey(algs: string[]): Promise<Key> {
    return WebcryptoKey.generate(undefined, algs)
  }

  getRandomValues(byteLength: number): Uint8Array {
    const bytes = new Uint8Array(byteLength)
    crypto.getRandomValues(bytes)
    return bytes
  }

  async digest(
    bytes: Uint8Array,
    algorithm: DigestAlgorithm,
  ): Promise<Uint8Array> {
    const buffer = crypto.createHash('sha256').digest()
    return new Uint8Array(buffer)
  }
}

// @ts-ignore
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

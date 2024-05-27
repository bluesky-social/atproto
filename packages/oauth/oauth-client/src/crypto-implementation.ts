import { Key } from '@atproto/jwk'

export type DigestAlgorithm = {
  name: 'sha256' | 'sha384' | 'sha512'
}

export type { Key }

export interface CryptoImplementation {
  createKey(algs: string[]): Key | PromiseLike<Key>
  getRandomValues: (length: number) => Uint8Array | PromiseLike<Uint8Array>
  digest: (
    bytes: Uint8Array,
    algorithm: DigestAlgorithm,
  ) => Uint8Array | PromiseLike<Uint8Array>
}

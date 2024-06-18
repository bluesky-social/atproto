import { WebcryptoKey } from '@atproto/jwk-webcrypto'
import {
  DigestAlgorithm,
  Key,
  RuntimeImplementation,
} from '@atproto/oauth-client'

export class BrowserRuntimeImplementation implements RuntimeImplementation {
  // https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request
  requestLock = navigator.locks?.request
    ? <T>(name: string, fn: () => T | PromiseLike<T>): Promise<T> =>
        navigator.locks.request(name, { mode: 'exclusive' }, async () => fn())
    : undefined

  constructor(private crypto = globalThis.crypto) {
    if (!crypto?.subtle) {
      throw new Error(
        'Crypto with CryptoSubtle is required. If running in a browser, make sure the current page is loaded over HTTPS.',
      )
    }

    if (!this.requestLock) {
      // There is no real need to polyfill this on older browsers. The
      // oauth-client library will try and recover from concurrency issues when
      // refreshing tokens.
      console.warn(
        'Locks API not available. You should consider using a more recent browser.',
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

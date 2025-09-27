import { WebcryptoKey } from '@atproto/jwk-webcrypto'
import {
  DigestAlgorithm,
  Key,
  RuntimeImplementation,
  RuntimeLock,
} from '@atproto/oauth-client'

/**
 * @see {@link // https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request}
 */
const nativeRequestLock: undefined | RuntimeLock = navigator.locks?.request
  ? <T>(name: string, fn: () => T | PromiseLike<T>): Promise<T> =>
      navigator.locks.request(name, { mode: 'exclusive' }, async () => fn())
  : undefined

export class BrowserRuntimeImplementation implements RuntimeImplementation {
  requestLock = nativeRequestLock

  constructor() {
    if (typeof crypto !== 'object' || !crypto?.subtle) {
      throw new Error(
        'Crypto with CryptoSubtle is required. If running in a browser, make sure the current page is loaded over HTTPS.',
      )
    }

    if (!this.requestLock) {
      // There is no real need to polyfill this on older browsers. Indeed, the
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

  getRandomValues(byteLength: number): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(byteLength))
  }

  async digest(
    data: Uint8Array<ArrayBufferLike>,
    { name }: DigestAlgorithm,
  ): Promise<Uint8Array<ArrayBuffer>> {
    switch (name) {
      case 'sha256':
      case 'sha384':
      case 'sha512': {
        const buf = await crypto.subtle.digest(
          `SHA-${name.slice(3)}`,
          data as Uint8Array<ArrayBuffer>,
        )
        return new Uint8Array<ArrayBuffer>(buf)
      }
      default:
        throw new Error(`Unsupported digest algorithm: ${name}`)
    }
  }
}

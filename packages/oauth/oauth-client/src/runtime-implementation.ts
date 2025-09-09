import { Key } from '@atproto/jwk'
import { Awaitable } from './util.js'

export type { Key }
export type RuntimeKeyFactory = (algs: string[]) => Key | PromiseLike<Key>

export type RuntimeRandomValues = (length: number) => Awaitable<Uint8Array>

export type DigestAlgorithm = { name: 'sha256' | 'sha384' | 'sha512' }
export type RuntimeDigest = (
  data: Uint8Array,
  alg: DigestAlgorithm,
) => Awaitable<Uint8Array>

export type RuntimeLock = <T>(
  name: string,
  fn: () => Awaitable<T>,
) => Awaitable<T>

export interface RuntimeImplementation {
  createKey: RuntimeKeyFactory
  getRandomValues: RuntimeRandomValues
  digest: RuntimeDigest
  requestLock?: RuntimeLock
}

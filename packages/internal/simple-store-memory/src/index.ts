import { LRUCache } from 'lru-cache'
import { Key, SimpleStore, Value } from '@atproto-labs/simple-store'
import { roughSizeOfObject } from './util.js'

export type SimpleStoreMemoryOptions<K extends Key, V extends Value> = {
  /**
   * The maximum number of entries in the cache.
   */
  max?: number

  /**
   * The time-to-live of a cache entry, in milliseconds.
   */
  ttl?: number

  /**
   * Whether to automatically prune expired entries.
   */
  ttlAutopurge?: boolean

  /**
   * The maximum total size of the cache, in units defined by the sizeCalculation
   * function.
   *
   * @default No limit
   */
  maxSize?: number

  /**
   * The maximum size of a single cache entry, in units defined by the
   * sizeCalculation function.
   *
   * @default No limit
   */
  maxEntrySize?: number

  /**
   * A function that returns the size of a value. The size is used to determine
   * when the cache should be pruned, based on `maxSize`.
   *
   * @default The (rough) size in bytes used in memory.
   */
  sizeCalculation?: (value: V, key: K) => number
} & ( // Memory is not infinite, so at least one pruning option is required.
  | { max: number }
  | { maxSize: number }
  | { ttl: number; ttlAutopurge: boolean }
)

// LRUCache does not allow storing "null", so we use a symbol to represent it.
const nullSymbol = Symbol('nullItem')
type AsLruValue<V extends Value> = V extends null
  ? typeof nullSymbol
  : Exclude<V, null>
const toLruValue = <V extends Value>(value: V) =>
  (value === null ? nullSymbol : value) as AsLruValue<V>
const fromLruValue = <V extends Value>(value: AsLruValue<V>) =>
  (value === nullSymbol ? null : value) as V

export class SimpleStoreMemory<K extends Key, V extends Value>
  implements SimpleStore<K, V>
{
  #cache: LRUCache<K, AsLruValue<V>>

  constructor({ sizeCalculation, ...options }: SimpleStoreMemoryOptions<K, V>) {
    this.#cache = new LRUCache<K, AsLruValue<V>>({
      ...options,
      allowStale: false,
      updateAgeOnGet: false,
      updateAgeOnHas: false,
      sizeCalculation: sizeCalculation
        ? (value, key) => sizeCalculation(fromLruValue(value), key)
        : options.maxEntrySize != null || options.maxSize != null
          ? // maxEntrySize and maxSize require a size calculation function.
            roughSizeOfObject
          : undefined,
    })
  }

  get(key: K): V | undefined {
    const value = this.#cache.get(key)
    if (value === undefined) return undefined

    return fromLruValue(value)
  }

  set(key: K, value: V): void {
    this.#cache.set(key, toLruValue(value))
  }

  del(key: K): void {
    this.#cache.delete(key)
  }

  clear(): void {
    this.#cache.clear()
  }
}

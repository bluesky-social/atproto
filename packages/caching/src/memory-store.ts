import { LRUCache } from 'lru-cache'

import { GenericStore, Key, Value } from './generic-store.js'

export type DidCacheMemoryOptions = LRUCache.Options<Key, Value, unknown>

export type MemoryStoreOptions<K extends Key, V extends Value> = {
  max?: number
  ttl?: number
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
} & (
  | {
      max: number
    }
  | {
      ttl: number
      ttlAutopurge: boolean
    }
  | {
      maxSize: number
    }
)

// LRUCache does not allow storing "null", so we use a symbol to represent it.

const nullSymbol = Symbol('nullItem')

type NormalizedValue<V extends Value> = Exclude<V, null> | typeof nullSymbol

const denormalize = <V extends Value>(value: NormalizedValue<V>) =>
  (value === nullSymbol ? null : value) as V

const normalize = <V extends Value>(value: V) =>
  value === null ? nullSymbol : (value as Exclude<V, null>)

export class MemoryStore<K extends Key, V extends Value>
  implements GenericStore<K, V>
{
  #cache: LRUCache<K, NormalizedValue<V>>

  constructor({ sizeCalculation, ...options }: MemoryStoreOptions<K, V>) {
    this.#cache = new LRUCache<K, NormalizedValue<V>>({
      ...options,
      allowStale: false,
      noDeleteOnStaleGet: true,
      sizeCalculation: sizeCalculation
        ? (value, key) => sizeCalculation(denormalize(value), key)
        : options.maxEntrySize != null || options.maxSize != null
          ? // maxEntrySize and maxSize require a size calculation function.
            roughSizeOfObject
          : undefined,
    })
  }

  get(key: K): V | undefined {
    const value = this.#cache.get(key)
    if (value === undefined) return undefined // Item not in cache

    return denormalize(value)
  }

  set(key: K, value: V): void {
    this.#cache.set(key, normalize(value))
  }

  del(key: K): void {
    this.#cache.delete(key)
  }

  clear(): void {
    this.#cache.clear()
  }
}

const knownSizes = new WeakMap<object, number>()

/**
 * @see {@link https://stackoverflow.com/a/11900218/356537}
 */
function roughSizeOfObject(value: unknown): number {
  const objectList = new Set()
  const stack = [value] // This would be more efficient using a circular buffer
  let bytes = 0

  while (stack.length) {
    const value = stack.pop()

    // > All objects on the heap start with a shape descriptor, which takes one
    // > pointer size (usually 4 bytes these days, thanks to "pointer
    // > compression" on 64-bit platforms).

    switch (typeof value) {
      // Types are ordered by frequency
      case 'string':
        // https://stackoverflow.com/a/68791382/356537
        bytes += 12 + 4 * Math.ceil(value.length / 4)
        break
      case 'number':
        bytes += 12 // Shape descriptor + double
        break
      case 'boolean':
        bytes += 4 // Shape descriptor
        break
      case 'object':
        bytes += 4 // Shape descriptor

        if (value === null) {
          break
        }

        if (knownSizes.has(value)) {
          bytes += knownSizes.get(value)!
          break
        }

        if (objectList.has(value)) continue
        objectList.add(value)

        if (Array.isArray(value)) {
          bytes += 4
          stack.push(...value)
        } else {
          bytes += 8
          const keys = Object.getOwnPropertyNames(value)
          for (let i = 0; i < keys.length; i++) {
            bytes += 4
            const key = keys[i]
            const val = value[key]
            if (val !== undefined) stack.push(val)
            stack.push(key)
          }
        }
        break
      case 'function':
        bytes += 8 // Shape descriptor + pointer (assuming functions are shared)
        break
      case 'symbol':
        bytes += 8 // Shape descriptor + pointer
        break
      case 'bigint':
        bytes += 16 // Shape descriptor + BigInt
        break
    }
  }

  if (typeof value === 'object' && value !== null) {
    knownSizes.set(value, bytes)
  }

  return bytes
}

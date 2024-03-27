import { Awaitable, GenericStore, Key, Value } from './generic-store.js'
import { MemoryStore } from './memory-store.js'

export type GetOptions<O = unknown> = O & {
  signal?: AbortSignal
  noCache?: boolean
}

export type Getter<K, V, O = unknown> = (
  key: K,
  options?: GetOptions<O>,
) => Awaitable<V>

export type PendingItem<V> = {
  promise: Promise<V>
  signal?: AbortSignal
}

export type ErrorHandler<K, R = void> = (err: unknown, key: K) => R | Promise<R>

export type CachedGetterOptions<K> = {
  onCacheError?: ErrorHandler<K>
}

/**
 * Wrapper utility that uses a cache to speed up the retrieval of values from a
 * getter function.
 */
export class CachedGetter<
  K extends Key = string,
  V extends Value = Value,
  O = unknown,
> {
  private pending = new Map<K, PendingItem<V>>()

  constructor(
    readonly getter: Getter<K, V, O>,
    readonly cache: GenericStore<K, V> = new MemoryStore<K, V>({
      max: 1000,
      ttl: 600e3,
    }),
    readonly options?: CachedGetterOptions<K>,
  ) {}

  async get(key: K, options?: GetOptions<O>): Promise<V> {
    if (options?.noCache !== true) {
      const cachedItem = await this.getCached(key, options)
      if (cachedItem !== undefined) return cachedItem
    }

    // As long as concurrent requests are made for the same key, only one
    // request will be made to the getter function. This work because there is
    // no async operation between the while() loop and the pending.set() call.
    // Because of the "single threaded" nature of JavaScript, the pending item
    // will be set before the next iteration of the while loop.
    let pending: undefined | PendingItem<V>
    while ((pending = this.pending.get(key))) {
      options?.signal?.throwIfAborted()

      try {
        return await pending.promise
      } catch (err) {
        // If the resolve() call was aborted, rethrow the error
        if (options?.signal?.aborted) throw err

        // The pending item failed due to a non abort error
        if (pending.signal?.aborted !== true) throw err
      }
    }

    try {
      options?.signal?.throwIfAborted()

      const promise = Promise.resolve(this.getter(key, options)).then(
        async (item) => {
          await this.setCached(key, item)
          return item
        },
      )

      this.pending.set(key, {
        promise,
        signal: options?.signal,
      })

      return await promise
    } finally {
      this.pending.delete(key)
    }
  }

  async getCached(key: K, options?: GetOptions<O>): Promise<V | undefined> {
    try {
      return await this.cache.get(key, options)
    } catch (err) {
      await this.options?.onCacheError?.(err, key)
      return undefined
    }
  }

  async setCached(key: K, value: V): Promise<void> {
    try {
      await this.cache.set(key, value)
    } catch (err) {
      await this.options?.onCacheError?.(err, key)
    }
  }

  async delCached(key: K): Promise<void> {
    try {
      await this.cache.del(key)
    } catch (err) {
      await this.options?.onCacheError?.(err, key)
    }
  }
}

import { Awaitable, GenericStore, Key, Value } from './generic-store.js'
import { MemoryStore } from './memory-store.js'

export type GetOptions = {
  signal?: AbortSignal
  noCache?: boolean
  allowStale?: boolean
}

export type Getter<K, V> = (
  key: K,
  options?: GetOptions,
  storedValue?: V,
) => Awaitable<V>

export type PendingItem<V> = {
  promise: Promise<V>
  allowCached: boolean
  signal?: AbortSignal
}

export type CachedGetterOptions<K, V> = {
  isStale?: (key: K, value: V) => boolean | PromiseLike<boolean>
  onStoreError?: (err: unknown, key: K, value: V) => void | PromiseLike<void>
  deleteOnError?: (
    err: unknown,
    key: K,
    value: V,
  ) => boolean | PromiseLike<boolean>
}

/**
 * Wrapper utility that uses a cache to speed up the retrieval of values from a
 * getter function.
 */
export class CachedGetter<K extends Key = string, V extends Value = Value> {
  private pending = new Map<K, PendingItem<V>>()

  constructor(
    readonly getter: Getter<K, V>,
    readonly store: GenericStore<K, V> = new MemoryStore<K, V>({
      max: 1000,
      ttl: 600e3,
    }),
    readonly options?: CachedGetterOptions<K, V>,
  ) {}

  async get(key: K, options?: GetOptions): Promise<V> {
    const allowCached = options?.noCache !== true
    const allowStale =
      this.options?.isStale == null ? true : options?.allowStale ?? false

    const checkCached = async (value: V) =>
      allowCached &&
      (allowStale || (await this.options?.isStale?.(key, value)) !== true)

    // As long as concurrent requests are made for the same key, only one
    // request will be made to the cache & getter function. This works because
    // there is no async operation between the while() loop and the
    // pending.set() call. Because of the "single threaded" nature of
    // JavaScript, the pending item will be set before the next iteration of the
    // while loop.
    let pending: undefined | PendingItem<V>
    while ((pending = this.pending.get(key))) {
      options?.signal?.throwIfAborted()

      try {
        const value = await pending.promise

        const isFresh = !pending.allowCached
        if (isFresh || (await checkCached(value))) {
          return value
        }
      } catch (err) {
        // If the get() call was aborted, rethrow the error
        if (options?.signal?.aborted) throw err

        // The pending item failed due to a non abort error
        if (pending.signal?.aborted !== true) throw err
      }
    }

    try {
      options?.signal?.throwIfAborted()

      const promise = Promise.resolve().then(async () => {
        const storedValue = await this.getStored(key, options)
        if (storedValue !== undefined) {
          if (await checkCached(storedValue)) {
            return storedValue
          }
        }

        return Promise.resolve()
          .then(async () => this.getter(key, options, storedValue))
          .catch(async (err) => {
            const shouldDelete =
              storedValue !== undefined &&
              (await this.options?.deleteOnError?.(err, key, storedValue))
            if (shouldDelete === true) await this.delStored(key)
            throw err
          })
          .then(async (value) => {
            await this.setStored(key, value)
            return value
          })
      })

      this.pending.set(key, {
        promise,
        signal: options?.signal,
        allowCached,
      })

      return await promise
    } finally {
      this.pending.delete(key)
    }
  }

  bind(key: K): (options?: GetOptions) => Promise<V> {
    return async (options) => this.get(key, options)
  }

  async getStored(key: K, options?: GetOptions): Promise<V | undefined> {
    try {
      return await this.store.get(key, options)
    } catch (err) {
      return undefined
    }
  }

  async setStored(key: K, value: V): Promise<void> {
    try {
      await this.store.set(key, value)
    } catch (err) {
      await this.options?.onStoreError?.(err, key, value)
    }
  }

  async delStored(key: K): Promise<void> {
    await this.store.del(key)
  }
}

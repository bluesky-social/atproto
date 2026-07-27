import type { Key, SimpleStore, Value } from './simple-store.js'

export type StoreOperation = 'get' | 'set' | 'del' | 'clear'

export type StoreErrorHandler<K extends Key = Key> = (
  err: unknown,
  operation: StoreOperation,
  key?: K,
) => void

/**
 * Default {@link StoreErrorHandler} that logs the error to the console.
 */
export const logStoreError: StoreErrorHandler = (err, operation) => {
  console.error(`SimpleStore error during "${operation}"`, err)
}

/**
 * Wraps a {@link SimpleStore} so that errors thrown by its operations are
 * caught and passed to `onError` instead of being propagated.
 *
 * This is meant to be used when the store acts as a *cache* in front of a real
 * source of truth: a transient store failure should degrade to a cache miss
 * (and a refetch from the getter) rather than break the operation. When used
 * with a {@link CachedGetter}, a swallowed `get` error resolves to `undefined`,
 * which the getter treats as a cache miss.
 *
 * Do *not* use this when the store is the source of truth (e.g. an OAuth
 * session store): in that case a persistence failure must be propagated.
 *
 * @note The `value` is intentionally not passed to `onError` to avoid logging
 * potentially large or sensitive payloads.
 */
export function swallowStoreErrors<K extends Key, V extends Value>(
  store: SimpleStore<K, V>,
  onError: StoreErrorHandler<K> = logStoreError,
): Required<SimpleStore<K, V>> {
  return {
    async get(key, options) {
      options?.signal?.throwIfAborted()
      try {
        return await store.get(key, options)
      } catch (err) {
        // A caller-initiated cancellation is control flow, not a store
        // failure: propagate it instead of logging it and returning a
        // (misleading) cache miss.
        if (options?.signal?.aborted) throw err
        onError(err, 'get', key)
        return undefined
      }
    },
    async set(key, value) {
      try {
        await store.set(key, value)
      } catch (err) {
        onError(err, 'set', key)
      }
    },
    async del(key) {
      try {
        await store.del(key)
      } catch (err) {
        onError(err, 'del', key)
      }
    },
    async clear() {
      try {
        await store.clear?.()
      } catch (err) {
        onError(err, 'clear')
      }
    },
  }
}

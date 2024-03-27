export type Awaitable<V> = V | PromiseLike<V>

export type Key = string | number
export type Value = NonNullable<unknown> | null

export type StoreGetOptions = {
  signal?: AbortSignal
}

export interface GenericStore<K extends Key, V extends Value = Value> {
  /**
   * @return undefined if the key is not in the cache.
   */
  get: (key: K, options?: StoreGetOptions) => Awaitable<undefined | V>
  set: (key: K, value: V) => Awaitable<void | this>
  del: (key: K) => Awaitable<void | this>
  clear?: () => Awaitable<void | this>
}

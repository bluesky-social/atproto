export type Awaitable<V> = V | PromiseLike<V>

export type Key = string | number
export type Value = NonNullable<unknown> | null

export type GetOptions = { signal?: AbortSignal }

export interface SimpleStore<K extends Key = string, V extends Value = Value> {
  /**
   * @return undefined if the key is not in the store (which is why Value cannot contain "undefined").
   */
  get: (key: K, options?: GetOptions) => Awaitable<undefined | V>
  set: (key: K, value: V) => Awaitable<void>
  del: (key: K) => Awaitable<void>
  clear?: () => Awaitable<void>
}

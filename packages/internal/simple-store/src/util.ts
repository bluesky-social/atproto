export type Awaitable<V> = V | PromiseLike<V>

export type ContextOptions<C> = C extends void | undefined
  ? { context?: undefined }
  : { context: C }

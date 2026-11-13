export type Awaitable<V> = V | PromiseLike<V>

export type ContextOptions<C> = C extends void | undefined
  ? { context?: undefined }
  : { context: C }

export function assert(
  condition: unknown,
  message = 'Assertion failed',
): asserts condition {
  if (!condition) throw new Error(message)
}

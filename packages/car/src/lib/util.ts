// @NOTE setImmediate does not exist in browser env
const setImmediate =
  globalThis.setImmediate ?? ((fn: () => void) => setTimeout(fn, 0))

/**
 * Yield to the event loop every {@link frequency} items in the case the
 * incoming iterable is synchronous, which can end up jamming up the thread
 */
export async function* eventLoopYieldingGenerator<T>(
  iterable: Iterable<T> | AsyncIterable<T>,
  frequency = 25,
): AsyncGenerator<T, void, unknown> {
  if (frequency <= 0 || !Number.isInteger(frequency)) {
    throw new TypeError('frequency must be a positive integer')
  }

  let count = 0
  for await (const item of iterable) {
    yield item
    count++
    if (count % frequency === 0) {
      await new Promise((resolve) => setImmediate(resolve))
    }
  }
}

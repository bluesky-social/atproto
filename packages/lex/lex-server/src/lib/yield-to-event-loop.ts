/**
 * Resolves on a later turn of the event loop, letting pending I/O and timers
 * run. Awaiting an already resolved promise only defers to the microtask
 * queue, which runs before any of them.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === 'function') setImmediate(resolve)
    else setTimeout(resolve, 0)
  })
}

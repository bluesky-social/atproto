import { Awaitable } from './type.js'

/**
 * Utility function to protect against timing attacks.
 */
export async function constantTime<T>(
  delay: number,
  fn: () => Awaitable<T>,
): Promise<T> {
  if (!Number.isFinite(delay) || delay <= 0) {
    throw new TypeError('Delay must be greater than 0')
  }

  const start = Date.now()
  try {
    return await fn()
  } finally {
    const delta = Date.now() - start

    // Let's make sure we always wait for a multiple of `delay` milliseconds.
    const n = Math.max(1, Math.ceil(delta / delay))

    // Ideally, the multiple should always be 1 in order to to properly defend
    // against timing attacks. Show a warning if it's not.
    if (n > 1) {
      console.warn(
        `constantTime: execution time was ${delta}ms, waiting for the next multiple of ${delay}ms. You should increase the delay to properly defend against timing attacks.`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, n * delay))
  }
}

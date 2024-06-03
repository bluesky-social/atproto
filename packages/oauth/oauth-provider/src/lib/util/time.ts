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
    if (delta < delay) {
      await new Promise((resolve) => setTimeout(resolve, delay - delta))
    } else {
      // The delay is too short, let's wait for the next multiple of `delay`
      // to avoid leaking information about the execution time.
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.ceil(delta / delay)),
      )
    }
  }
}

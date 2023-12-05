import { wait } from './util'

export type RetryOptions = {
  maxRetries?: number
  getWaitMs?: (n: number) => number | null
  retryable?: (err: unknown) => boolean
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, retryable = () => true, getWaitMs = backoffMs } = opts
  let retries = 0
  let doneError: unknown
  while (!doneError) {
    try {
      return await fn()
    } catch (err) {
      const waitMs = getWaitMs(retries)
      const willRetry =
        retries < maxRetries && waitMs !== null && retryable(err)
      if (willRetry) {
        retries += 1
        if (waitMs !== 0) {
          await wait(waitMs)
        }
      } else {
        doneError = err
      }
    }
  }
  throw doneError
}

// Waits exponential backoff with max and jitter: ~100, ~200, ~400, ~800, ~1000, ~1000, ...
export function backoffMs(n: number, multiplier = 100, max = 1000) {
  const exponentialMs = Math.pow(2, n) * multiplier
  const ms = Math.min(exponentialMs, max)
  return jitter(ms)
}

// Adds randomness +/-15% of value
function jitter(value: number) {
  const delta = value * 0.15
  return value + randomRange(-delta, delta)
}

function randomRange(from: number, to: number) {
  const rand = Math.random() * (to - from)
  return rand + from
}

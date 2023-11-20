import { wait } from './util'

export type RetryOptions = {
  maxRetries?: number
  backoffMultiplier?: number
  backoffMax?: number
  retryable?: (err: unknown) => boolean
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, retryable = () => true } = opts
  let retries = 0
  let doneError: unknown
  while (!doneError) {
    try {
      if (retries)
        await backoff(retries, opts.backoffMultiplier, opts.backoffMax)
      return await fn()
    } catch (err) {
      const willRetry = retries < maxRetries && retryable(err)
      if (!willRetry) doneError = err
      retries += 1
    }
  }
  throw doneError
}

// Waits exponential backoff with max and jitter: ~50, ~100, ~200, ~400, ~800, ~1000, ~1000, ...
async function backoff(n: number, multiplier = 50, max = 1000) {
  const exponentialMs = Math.pow(2, n) * multiplier
  const ms = Math.min(exponentialMs, max)
  await wait(jitter(ms))
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

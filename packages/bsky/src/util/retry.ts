import { AxiosError } from 'axios'
import { wait } from '@atproto/common'
import { XRPCError, ResponseType } from '@atproto/xrpc'

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { max = 3, retryable = () => true } = opts
  let retries = 0
  let doneError: unknown
  while (!doneError) {
    try {
      if (retries) await backoff(retries)
      return await fn()
    } catch (err) {
      const willRetry = retries < max && retryable(err)
      if (!willRetry) doneError = err
      retries += 1
    }
  }
  throw doneError
}

export async function retryHttp<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  return retry(fn, { retryable: retryableHttp, ...opts })
}

export function retryableHttp(err: unknown) {
  if (err instanceof XRPCError) {
    if (err.status === ResponseType.Unknown) return true
    return retryableHttpStatusCodes.has(err.status)
  }
  if (err instanceof AxiosError) {
    if (!err.response) return true
    return retryableHttpStatusCodes.has(err.response.status)
  }
  return false
}

const retryableHttpStatusCodes = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

type RetryOptions = {
  max?: number
  retryable?: (err: unknown) => boolean
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

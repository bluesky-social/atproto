import { WebSocketClientError } from './errors.js'

export { FATAL_CLOSE_CODES, isReconnectableClose } from './close-codes.js'

/**
 * Default reconnect policy: each `WebSocketClientError` subclass classifies
 * itself via `shouldRetry()` — `CloseError` by close code, network trouble and
 * liveness timeouts retryable, local resource and protocol errors fatal. Any
 * error outside the taxonomy is fatal.
 */
export function defaultShouldReconnect(error: unknown): boolean {
  return error instanceof WebSocketClientError && error.shouldRetry()
}

/** Exponential backoff with ±0.5s jitter, capped at maxMs. Ported from WebSocketKeepAlive. */
export function backoffMs(attempt: number, maxMs: number): number {
  const baseSec = Math.pow(2, attempt) // 1, 2, 4, 8, ...
  const jitterSec = Math.random() - 0.5 // -0.5 .. +0.5
  const ms = 1000 * (baseSec + jitterSec)
  return Math.min(ms, maxMs)
}

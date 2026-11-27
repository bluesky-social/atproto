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

/**
 * Exponential backoff capped at maxMs, jittered down to half of it. The jitter
 * is proportional and applied after the cap, so that clients that failed
 * together keep spreading out once capped, rather than all retrying in
 * lockstep every maxMs.
 */
export function backoffMs(attempt: number, maxMs: number): number {
  const ms = Math.min(1000 * 2 ** attempt, maxMs) // 1s, 2s, 4s, ... maxMs
  return ms * (0.5 + Math.random() / 2) // 50% .. 100%
}

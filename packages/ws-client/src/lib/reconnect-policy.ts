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
 * Exponential backoff, its base capped at maxMs, jittered by ±50%. Applied
 * after the cap, so that clients that failed together keep spreading out once
 * capped (up to 1.5 × maxMs), rather than all retrying in lockstep every maxMs.
 * Never below half the base, so a retry is never immediate, even on the first
 * attempt, when the most clients come back at once (those of a server that
 * shut down, whose backoff had started over).
 */
export function backoffMs(attempt: number, maxMs: number): number {
  const ms = Math.min(1000 * 2 ** attempt, maxMs) // 1s, 2s, 4s, ... maxMs
  return ms * (0.5 + Math.random()) // 50% .. 150%
}

import {
  AbnormalCloseError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
} from './errors.js'

/**
 * Close codes that are FATAL — the connection should not be retried. These are
 * only codes a peer deliberately sends on the wire to signal normal shutdown
 * (1000) or a malformed-protocol condition (1002/1003/1007/1009).
 *
 * Synthetic codes (1005 no-status, 1006 abnormal, 1015 TLS) are intentionally
 * absent: per RFC 6455 §7.4.1 they MUST NOT appear in a wire Close frame — an
 * endpoint generates them locally to describe transient connection trouble.
 * They therefore represent the same failures that surface as SocketError in the
 * other runtime, and must classify identically (reconnect). Do not add them.
 */
export const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([
  1000, 1002, 1003, 1007, 1009,
])

export function isReconnectableClose(code: number): boolean {
  return !FATAL_CLOSE_CODES.has(code)
}

/**
 * Default reconnect policy over WebSocketCore's typed errors:
 * - AbnormalCloseError → classify by close code (isReconnectableClose)
 * - SocketError / HeartbeatTimeoutError / IdleTimeoutError → reconnect
 * - anything else (BufferOverflowError, DataModeError, foreign errors) → fatal
 */
export function defaultShouldReconnect(error: unknown): boolean {
  if (error instanceof AbnormalCloseError) {
    return isReconnectableClose(error.code)
  }
  return (
    error instanceof SocketError ||
    error instanceof HeartbeatTimeoutError ||
    error instanceof IdleTimeoutError
  )
}

/** Exponential backoff with ±0.5s jitter, capped at maxMs. Ported from WebSocketKeepAlive. */
export function backoffMs(attempt: number, maxMs: number): number {
  const baseSec = Math.pow(2, attempt) // 1, 2, 4, 8, ...
  const jitterSec = Math.random() - 0.5 // -0.5 .. +0.5
  const ms = 1000 * (baseSec + jitterSec)
  return Math.min(ms, maxMs)
}

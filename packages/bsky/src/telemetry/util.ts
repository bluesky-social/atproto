import { Code, ConnectError } from '@connectrpc/connect'

/**
 * Whether we gave up on the call: an `AbortSignal.timeout()` of ours elapsed,
 * which rejects with a `DOMException` named `TimeoutError` (per the DOM spec).
 *
 * @note Connect wraps that exception in a `ConnectError`, so it is only
 * reachable through `cause`.
 */
export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err instanceof DOMException && err.name === 'TimeoutError') return true
  return isAbortError(err.cause)
}

/**
 * Whether the dataplane gave up on the call, reported as the gRPC
 * `DeadlineExceeded` status.
 */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.DeadlineExceeded
}

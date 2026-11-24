/**
 * Uses the native `AbortSignal.throwIfAborted()` when available, falling back
 * for older implementations such as React Native's `abort-controller`.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal) return
  if (typeof signal.throwIfAborted === 'function') {
    signal.throwIfAborted()
    return
  }
  if (signal.aborted) throw getAbortReason(signal)
}

export function getAbortReason(signal: AbortSignal): unknown {
  if ('reason' in signal) return signal.reason
  return buildAbortReason()
}

function buildAbortReason(message = 'Aborted', name = 'AbortError'): Error {
  // Fallback for runtimes without a DOMException (React Native)
  if (typeof DOMException !== 'function') {
    return Object.assign(new Error(message), { name })
  }

  return new DOMException(message, name)
}

export function isCausedBySignal(err: unknown, signal?: AbortSignal) {
  if (!signal?.aborted) return false
  if (signal.reason == null) return false // Ignore nullish reasons
  return (
    err === signal.reason ||
    (err instanceof Error && err.cause === signal.reason)
  )
}

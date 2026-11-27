import { walkErrorCauses } from './error.js'

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
  const { reason } = signal
  if (reason == null) return false // Ignore nullish reasons
  if (reason === err) return true
  for (const cause of walkErrorCauses(err)) {
    if (cause === reason) return true
  }

  return false
}

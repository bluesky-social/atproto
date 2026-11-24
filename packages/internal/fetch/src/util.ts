// @TODO: Move some of these to a shared package ?

export type ThisParameterOverride<
  C,
  Fn extends (...a: any) => any,
> = Fn extends (...args: infer P) => infer R
  ? ((this: C, ...args: P) => R) & {
      bind(context: C): (...args: P) => R
    }
  : never

export function isIp(hostname: string) {
  // IPv4
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) return true

  // IPv6
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true

  return false
}

export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export class MaxBytesTransformStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor(maxBytes: number) {
    // Note: negation accounts for invalid value types (NaN, non numbers)
    if (!(maxBytes >= 0)) {
      throw new TypeError('maxBytes must be a non-negative number')
    }

    let bytesRead = 0

    super({
      transform: (
        chunk: Uint8Array,
        ctrl: TransformStreamDefaultController<Uint8Array>,
      ) => {
        if ((bytesRead += chunk.length) <= maxBytes) {
          ctrl.enqueue(chunk)
        } else {
          ctrl.error(new Error('Response too large'))
        }
      },
    })
  }
}

const LINE_BREAK = /\r?\n/g
export function padLines(input: string, pad: string) {
  if (!input) return input
  return pad + input.replace(LINE_BREAK, `$&${pad}`)
}

export function logCancellationError(err: unknown): void {
  console.warn('Failed to cancel response body', err)
}

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

export function buildAbortReason(
  message = 'Aborted',
  name = 'AbortError',
): unknown {
  // Fallback for runtimes without a DOMException (React Native)
  if (typeof DOMException === 'undefined') {
    const error = new Error(message)
    Object.defineProperty(error, 'name', { value: name })
    return error
  }

  return new DOMException(message, name)
}

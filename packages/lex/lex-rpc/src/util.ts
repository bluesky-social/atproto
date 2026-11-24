import { getAbortReason, throwIfAborted } from './abort.js'

export function wait(
  ms: number,
  { signal }: { signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal)

    const cleanup = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      cleanup()
      // @NOTE the signal exists because this listener came from it.
      reject(getAbortReason(signal!))
    }

    signal?.addEventListener('abort', onAbort)
  })
}

export function* walkErrorCauses(
  error: unknown,
): Generator<Error, void, unknown> {
  let current: unknown = error
  for (let depth = 0; depth < 8 && current instanceof Error; depth++) {
    yield current
    current = current.cause
  }
}

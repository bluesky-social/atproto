export type Awaitable<T> = T | PromiseLike<T>
export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export function contentMime(headers: Headers): string | undefined {
  return headers.get('content-type')?.split(';')[0]!.trim()
}

/**
 * Returns an {@link AbortSignal} that aborts after `ms` milliseconds.
 *
 * Uses the native {@link AbortSignal.timeout} when available, and otherwise
 * falls back to an {@link AbortController} + `setTimeout`. The static
 * `AbortSignal.timeout` method is not implemented in every runtime this package
 * targets (notably React Native / Expo), so relying on it directly throws a
 * `TypeError: AbortSignal.timeout is not a function` at runtime.
 *
 * @see {@link https://github.com/facebook/react-native/issues/42042}
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(timeoutError(ms)), ms)
  return controller.signal
}

/**
 * Builds the reason used to abort a {@link timeoutSignal} fallback. Mirrors the
 * native `AbortSignal.timeout` behaviour (a `TimeoutError` `DOMException`) when
 * `DOMException` is available, and degrades to a plain `Error` in runtimes that
 * lack it.
 */
function timeoutError(ms: number): unknown {
  const message = `The operation timed out after ${ms} ms`
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'TimeoutError')
  }
  return new Error(message)
}

export function combineSignals(
  signals: readonly (AbortSignal | undefined)[],
): AbortController & Disposable {
  const controller = new DisposableAbortController()

  const onAbort = function (this: AbortSignal, _event: Event) {
    const reason = new Error('This operation was aborted', {
      cause: this.reason,
    })

    controller.abort(reason)
  }

  try {
    for (const sig of signals) {
      if (sig) {
        sig.throwIfAborted()
        sig.addEventListener('abort', onAbort, { signal: controller.signal })
      }
    }

    return controller
  } catch (err) {
    controller.abort(err)
    throw err
  }
}

/**
 * Allows using {@link AbortController} with the `using` keyword, in order to
 * automatically abort them once the execution block ends.
 */
class DisposableAbortController extends AbortController implements Disposable {
  [Symbol.dispose]() {
    this.abort(new Error('AbortController was disposed'))
  }
}

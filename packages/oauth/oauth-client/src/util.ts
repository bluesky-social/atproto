export type Awaitable<T> = T | PromiseLike<T>
export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export function contentMime(headers: Headers): string | undefined {
  return headers.get('content-type')?.split(';')[0]!.trim()
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

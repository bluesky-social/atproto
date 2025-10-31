export type Awaitable<T> = T | PromiseLike<T>
export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export function contentMime(headers: Headers): string | undefined {
  return headers.get('content-type')?.split(';')[0]!.trim()
}

/**
 * Ponyfill for `CustomEvent` constructor.
 */
export const CustomEvent: typeof globalThis.CustomEvent =
  globalThis.CustomEvent ??
  (() => {
    class CustomEvent<T> extends Event {
      #detail: T | null
      constructor(type: string, options?: CustomEventInit<T>) {
        if (!arguments.length) throw new TypeError('type argument is required')
        super(type, options)
        this.#detail = options?.detail ?? null
      }
      get detail() {
        return this.#detail
      }
    }

    Object.defineProperties(CustomEvent.prototype, {
      [Symbol.toStringTag]: {
        writable: false,
        enumerable: false,
        configurable: true,
        value: 'CustomEvent',
      },
      detail: {
        enumerable: true,
      },
    })

    return CustomEvent
  })()

export class CustomEventTarget<EventDetailMap extends Record<string, unknown>> {
  readonly eventTarget = new EventTarget()

  addEventListener<T extends Extract<keyof EventDetailMap, string>>(
    type: T,
    callback: (event: CustomEvent<EventDetailMap[T]>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this.eventTarget.addEventListener(type, callback as EventListener, options)
  }

  removeEventListener<T extends Extract<keyof EventDetailMap, string>>(
    type: T,
    callback: (event: CustomEvent<EventDetailMap[T]>) => void,
    options?: EventListenerOptions | boolean,
  ): void {
    this.eventTarget.removeEventListener(
      type,
      callback as EventListener,
      options,
    )
  }

  dispatchCustomEvent<T extends Extract<keyof EventDetailMap, string>>(
    type: T,
    detail: EventDetailMap[T],
    init?: EventInit,
  ): boolean {
    return this.eventTarget.dispatchEvent(
      new CustomEvent(type, { ...init, detail }),
    )
  }
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

export type Awaitable<T> = T | PromiseLike<T>
export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

// @ts-expect-error
Symbol.dispose ??= Symbol('@@dispose')

/**
 * @todo (?) move to common package
 */
export const timeoutSignal = (
  timeout: number,
  options?: { signal?: AbortSignal },
): AbortSignal & Disposable => {
  if (!Number.isInteger(timeout) || timeout < 0) {
    throw new TypeError('Expected a positive integer')
  }

  options?.signal?.throwIfAborted()

  const controller = new AbortController()
  const { signal } = controller

  options?.signal?.addEventListener(
    'abort',
    (reason) => controller.abort(reason),
    { once: true, signal },
  )

  const timeoutId = setTimeout(
    (err) => controller.abort(err),
    timeout,
    // create Error here to keep original stack trace
    new Error('Timeout'),
  )

  timeoutId?.unref?.() // NodeJS only

  signal.addEventListener('abort', () => clearTimeout(timeoutId), {
    once: true,
    signal,
  })

  Object.defineProperty(signal, Symbol.dispose, {
    value: () => controller.abort(),
  })

  return signal as AbortSignal & Disposable
}

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

export type SpaceSeparatedValue<Value extends string> =
  | `${Value}`
  | `${Value} ${string}`
  | `${string} ${Value}`
  | `${string} ${Value} ${string}`

export const includesSpaceSeparatedValue = <Value extends string>(
  input: string,
  value: Value,
): input is SpaceSeparatedValue<Value> => {
  // Optimized version of:
  // return input.split(' ').includes(value)

  let idx = input.indexOf(value)
  while (idx !== -1) {
    const endIdx = idx + value.length
    if (
      // at beginning or preceded by space
      (idx === 0 || input[idx - 1] === ' ') &&
      // at end or followed by space
      (endIdx === input.length || input[endIdx] === ' ')
    ) {
      return true
    }
    idx = input.indexOf(value, endIdx)
  }

  return false
}

export function combineSignals(
  signals: readonly (AbortSignal | undefined)[],
): undefined | AbortSignal {
  const { length } = signals.filter(Boolean)
  if (length === 0) return undefined
  if (length === 1) return signals.find(Boolean)!

  const controller = new AbortController()
  const { signal } = controller

  for (const signal of signals) {
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { signal })
    }
  }

  return signal
}

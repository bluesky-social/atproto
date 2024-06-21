export type Awaitable<T> = T | PromiseLike<T>

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
  ): boolean {
    return this.eventTarget.dispatchEvent(new CustomEvent(type, { detail }))
  }
}

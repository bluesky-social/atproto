import { FetchRequestError } from './fetch-request.js'
import { Fetch, FetchContext, toRequestTransformer } from './fetch.js'
import { TransformedResponse } from './transformed-response.js'
import { padLines, stringifyMessage } from './util.js'

type LogFn<Args extends unknown[]> = (...args: Args) => void | PromiseLike<void>

export function loggedFetch<C = FetchContext>({
  fetch = globalThis.fetch as Fetch<C>,
  logRequest = true as boolean | LogFn<[request: Request]>,
  logResponse = true as boolean | LogFn<[response: Response, request: Request]>,
  logError = true as boolean | LogFn<[error: unknown, request: Request]>,
}) {
  const onRequest =
    logRequest === true
      ? async (request) => {
          const requestMessage = await stringifyMessage(request)
          console.info(
            `> ${request.method} ${request.url}\n${padLines(requestMessage, '  ')}`,
          )
        }
      : logRequest || undefined

  const onResponse =
    logResponse === true
      ? async (response) => {
          const responseMessage = await stringifyMessage(response.clone())
          console.info(
            `< HTTP/1.1 ${response.status} ${response.statusText}\n${padLines(responseMessage, '  ')}`,
          )
        }
      : logResponse || undefined

  const onError =
    logError === true
      ? async (error) => {
          console.error(`< Error:`, error)
        }
      : logError || undefined

  if (!onRequest && !onResponse && !onError) return fetch

  return toRequestTransformer(async function (
    this: C,
    request,
  ): Promise<Response> {
    if (onRequest) await onRequest(request)

    try {
      const response = await fetch.call(this, request)

      if (onResponse) await onResponse(response, request)

      return response
    } catch (error) {
      if (onError) await onError(error, request)

      throw error
    }
  })
}

export const timedFetch = <C = FetchContext>(
  timeout = 60e3,
  fetch: Fetch<C> = globalThis.fetch,
): Fetch<C> => {
  if (timeout === Infinity) return fetch
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('Timeout must be positive')
  }
  return toRequestTransformer(async function (
    this: C,
    request,
  ): Promise<Response> {
    const controller = new AbortController()
    const signal = controller.signal

    const abort = () => {
      controller.abort()
    }
    const cleanup = () => {
      clearTimeout(timer)
      request.signal?.removeEventListener('abort', abort)
    }

    const timer = setTimeout(abort, timeout)
    if (typeof timer === 'object') timer.unref?.() // only on node
    request.signal?.addEventListener('abort', abort)

    signal.addEventListener('abort', cleanup)

    const response = await fetch.call(this, request, { signal })

    if (!response.body) {
      cleanup()
      return response
    } else {
      // Cleanup the timer & event listeners when the body stream is closed
      const transform = new TransformStream({ flush: cleanup })
      return new TransformedResponse(response, transform)
    }
  })
}

/**
 * Wraps a fetch function to bind it to a specific context, and wrap any thrown
 * errors into a FetchRequestError.
 *
 * @example
 *
 * ```ts
 * class MyClient {
 *   constructor(private fetch = globalThis.fetch) {}
 *
 *   async get(url: string) {
 *     // This will generate an error, because the context used is not a
 *     // FetchContext (it's a MyClient instance).
 *     return this.fetch(url)
 *   }
 * }
 * ```
 *
 * @example
 *
 * ```ts
 * class MyClient {
 *   private fetch: Fetch<unknown>
 *
 *   constructor(fetch = globalThis.fetch) {
 *     this.fetch = bindFetch(fetch)
 *   }
 *
 *   async get(url: string) {
 *     return this.fetch(url) // no more error
 *   }
 * }
 * ```
 */
export function bindFetch<C = FetchContext>(
  fetch: Fetch<C> = globalThis.fetch,
  context: C = globalThis as C,
) {
  return toRequestTransformer(async (request) => {
    try {
      return await fetch.call(context, request)
    } catch (err) {
      throw FetchRequestError.from(request, err)
    }
  })
}

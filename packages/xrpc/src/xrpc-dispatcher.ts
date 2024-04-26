import { Gettable } from './types'

export type Fetch = (request: Request) => Promise<Response>
export type Dispatch = (
  /**
   * The URL (pathname + query parameters) to make the request to, without the
   * origin. The origin (protocol, hostname, and port) must be added by this
   * {@link FetchHandler}, typically based on authentication or other factors.
   */
  url: string,
  init: RequestInit,
) => Promise<Response>

export type XrpcDispatcherOptions =
  | Dispatch
  | BuildDispatchOptions
  | string
  | URL

/**
 * Default {@link FetchAgent} implementation that uses WHATWG's `fetch` API and
 * no authentication. This class would typically be extended to add authentication
 * or other features (retry, session management, etc.).
 *
 * @example
 * ```ts
 * class MyDispatcher extends XrpcDispatcher {
 *   constructor(
 *     public serviceUri: string | URL,
 *     public bearer?: string,
 *   ) {
 *     super({
 *       service: serviceUri
 *       headers: () => ({ authorization: `Bearer ${this.bearer}` }),
 *     })
 *   }
 * }
 *
 * const client = new XrpcClient(new MyDispatcher('https://example.com', 'my-token'))
 * ```
 *
 * @example
 * ```ts
 * class MyDispatcher extends XrpcDispatcher {
 *   constructor(
 *     public serviceUri: string | URL,
 *     public bearer?: string,
 *   ) {
 *     super((url, init) => {
 *       const uri = new URL(url, this.serviceUri)
 *       const request = new Request(uri, init)
 *       if (this.bearer) {
 *         request.headers.set('Authorization', `Bearer ${this.bearer}`)
 *       }
 *       return globalThis.fetch(request)
 *     })
 *   }
 * }
 *
 * const client = new XrpcClient(new MyDispatcher('https://example.com', 'my-token'))
 * ```
 */
export class XrpcDispatcher {
  public readonly dispatch: Dispatch
  constructor(options: XrpcDispatcherOptions) {
    this.dispatch = buildDispatch(options).bind(this)
  }
}

export type BuildDispatchOptions = {
  /**
   * The service URL to make requests to. This can be a string, URL, or a
   * function that returns a string or URL. This is useful for dynamic URLs,
   * such as a service URL that changes based on authentication.
   */
  service: Gettable<string | URL, never>

  /**
   * Headers to be added to every request. If a function is provided, it will be
   * called on each request to get the headers. This is useful for dynamic
   * headers, such as authentication tokens that may expire.
   */
  headers?:
    | { [_ in string]?: Gettable<null | string> }
    | (() => Iterable<
        [name: string, value: string, options?: { override?: boolean }]
      >)

  /**
   * Bring your own fetch implementation. Typically useful for testing, logging,
   * mocking, or adding retries, session management, signatures, proof of
   * possession (DPoP), etc. Defaults to the global `fetch` function.
   */
  fetch?: (request: Request) => Promise<Response>
}

export function buildDispatch(options: XrpcDispatcherOptions): Dispatch {
  if (typeof options === 'function') return options

  const {
    service,
    headers = undefined,
    fetch = globalThis.fetch,
  } = typeof options === 'string' || options instanceof URL
    ? { service: options }
    : options

  if (typeof fetch !== 'function') {
    throw new TypeError(
      'XrpcDispatcher requires fetch() to be available in your environment.',
    )
  }

  return async function (url, init) {
    const base = typeof service === 'function' ? await service() : service
    const request = new Request(new URL(url, base), init)
    if (typeof headers === 'function') {
      for (const [key, value, options = undefined] of headers()) {
        if (options?.override ?? !request.headers.has(key)) {
          request.headers.set(key, value)
        }
      }
    } else if (headers) {
      for (const [key, getter] of Object.entries(headers)) {
        if (request.headers.has(key)) continue

        const value = typeof getter === 'function' ? await getter() : getter
        if (value == null) continue

        request.headers.set(key, value)
      }
    }
    return fetch(request)
  }
}

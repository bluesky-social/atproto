import { FetchHandler, Headers } from './types'
import { XrpcAgent } from './xrpc-agent'

export type XrpcFetchAgentOptions = FetchHandler | BuildFetcherOptions

export class XrpcFetchAgent implements XrpcAgent {
  fetchHandler: FetchHandler

  constructor(options: XrpcFetchAgentOptions) {
    this.fetchHandler =
      typeof options === 'function' ? options : buildFetchHandler(options)
  }
}

export type BuildFetcherConfig = {
  /**
   * The service URL to make requests to. This can be a string, URL, or a
   * function that returns a string or URL. This is useful for dynamic URLs,
   * such as a service URL that changes based on authentication.
   */
  service: string | URL | (() => string | URL | PromiseLike<string | URL>)

  /**
   * Headers to be added to every request. If a function is provided, it will be
   * called on each request to get the headers. This is useful for dynamic
   * headers, such as authentication tokens that may expire.
   */
  headers?:
    | Partial<Headers>
    | (() => Partial<Headers> | PromiseLike<Partial<Headers>>)

  /**
   * DYO fetch implementation. Typically useful for testing, logging, mocking,
   * or adding retries, session management, signatures, proof of possession
   * (DPoP), etc. Defaults to the global `fetch` function.
   */
  fetch?: (request: Request) => Promise<Response>
}

export type BuildFetcherOptions = string | URL | BuildFetcherConfig
export function buildFetchHandler(options: BuildFetcherOptions): FetchHandler {
  const {
    service,
    headers = undefined,
    fetch = globalThis.fetch,
  } = typeof options === 'string' || options instanceof URL
    ? { service: options }
    : options

  if (typeof fetch !== 'function') {
    throw new TypeError(
      'XrpcAgent requires fetch() to be available in your environment.',
    )
  }

  return async function (url, init) {
    const base = typeof service === 'function' ? await service() : service
    const request = new Request(new URL(url, base), init)
    if (headers) {
      const h = typeof headers === 'function' ? await headers() : headers
      for (const [k, v] of Object.entries(h)) {
        if (v != null) request.headers.set(k, v)
      }
    }
    return fetch(request)
  }
}

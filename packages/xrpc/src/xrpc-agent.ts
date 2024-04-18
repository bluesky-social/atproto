import {
  FetchAgent,
  FetchHandlerResponse,
  Headers,
  ResponseType,
  XRPCError,
} from './types'
import { encodeMethodCallBody, httpResponseBodyParse } from './util'

/**
 * Default {@link FetchAgent} implementation that uses WHATWG's `fetch` API and
 * no authentication. This class would typically be extended to add authentication
 * or other features (retry, session management, etc.).
 *
 * @example
 * ```ts
 * class MyAgent extends XrpcAgent {
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
 * const client = new XrpcClient(new MyAgent('https://example.com', 'my-token'))
 * ```
 */
export class XrpcAgent implements FetchAgent {
  static forOrigin(
    url: string | URL,
    fetch: (request: Request) => Promise<Response> = globalThis.fetch,
  ): XrpcAgent {
    if (typeof fetch !== 'function') {
      throw new TypeError(
        'The default XRPC Agent requires the fetch() function to be globally available.',
      )
    }

    // Parse the url to ensure it is valid, and keep only the origin
    const { origin } = url instanceof URL ? url : new URL(url)

    return new XrpcAgent((url, init) =>
      fetch(new Request(new URL(url, origin), init)),
    )
  }

  constructor(
    /**
     * A wrapper around the WHATWG `fetch` API that will, at minima, add the
     * origin to the URL before making the request.
     *
     * @param url The URL (pathname + query parameters) to make the request to,
     * without the
     */
    private fetchFn: (url: string, init: RequestInit) => Promise<Response>,
  ) {}

  async fetch(
    httpUrl: string,
    httpMethod: string,
    httpHeaders: Headers,
    httpReqBody: unknown,
  ): Promise<FetchHandlerResponse> {
    const ac = new AbortController()

    try {
      // The duplex field is now required for streaming bodies, but not yet reflected
      // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
      const reqInit: RequestInit & { duplex: string } = {
        method: httpMethod,
        headers: httpHeaders,
        body: encodeMethodCallBody(httpHeaders, httpReqBody),
        duplex: 'half',
        signal: ac.signal,
      }
      const res = await this.fetchFn(httpUrl, reqInit)
      const resBody = await res.arrayBuffer()
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: httpResponseBodyParse(res.headers.get('content-type'), resBody),
      }
    } catch (e) {
      const err = new XRPCError(ResponseType.Unknown, String(e))
      err.cause = e // Keep trace of the original error for debugging
      throw err
    }
  }
}

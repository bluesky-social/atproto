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
export interface XrpcAgent {
  fetchHandler(
    /**
     * The URL (pathname + query parameters) to make the request to, without the
     * origin. The origin (protocol, hostname, and port) must be added by this
     * {@link FetchHandler}, typically based on authentication or other factors.
     */
    url: string,
    init: RequestInit,
  ): Promise<Response>
}

export function isXrpcAgent<T>(agent: T): agent is T & XrpcAgent {
  return (
    agent != null &&
    typeof agent === 'object' &&
    'fetchHandler' in agent &&
    typeof agent.fetchHandler === 'function'
  )
}

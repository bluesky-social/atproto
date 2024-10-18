import {
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
  isResolvedHandle,
} from '../types.js'

export type WellKnownHandleResolverOptions = {
  /**
   * Fetch function to use for HTTP requests. Allows customizing the request
   * behavior, e.g. adding headers, setting a timeout, mocking, etc. The
   * provided fetch function will be wrapped with a safeFetchWrap function that
   * adds SSRF protection.
   *
   * @default `globalThis.fetch`
   */
  fetch?: typeof globalThis.fetch
}

export class WellKnownHandleResolver implements HandleResolver {
  protected readonly fetch: typeof globalThis.fetch

  constructor(options?: WellKnownHandleResolverOptions) {
    this.fetch = options?.fetch ?? globalThis.fetch
  }

  public async resolve(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    const url = new URL('/.well-known/atproto-did', `https://${handle}`)

    try {
      const response = await this.fetch.call(null, url, {
        cache: options?.noCache ? 'no-cache' : undefined,
        signal: options?.signal,
        redirect: 'error',
      })
      const text = await response.text()
      const firstLine = text.split('\n')[0]!.trim()

      if (isResolvedHandle(firstLine)) return firstLine

      return null
    } catch (err) {
      // The the request failed, assume the handle does not resolve to a DID,
      // unless the failure was due to the signal being aborted.
      options?.signal?.throwIfAborted()

      return null
    }
  }
}

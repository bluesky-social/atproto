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
      // If the request was aborted, propagate the abort error.
      options?.signal?.throwIfAborted()

      // The WHATWG fetch standard rejects with a `TypeError` for genuine
      // network failures (DNS failure, connection refused, blocked redirect,
      // …). Those mean the handle's well-known endpoint is unreachable, so we
      // treat the handle as unresolved and return `null`.
      //
      // Any other error type is unexpected (e.g. the SSRF/unicast protection
      // added by `safeFetchWrap` throws before any network exchange, a custom
      // `fetch` implementation misbehaving, or a programming error). Per the
      // `HandleResolver` contract, `null` must only be returned when no
      // unexpected behavior occurred, so we re-throw to surface the real cause
      // instead of silently hiding it.
      if (err instanceof TypeError) return null

      throw err
    }
  }
}

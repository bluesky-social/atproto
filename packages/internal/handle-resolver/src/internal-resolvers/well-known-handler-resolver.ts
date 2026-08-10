import { HandleResolverError } from '../handle-resolver-error.js'
import {
  type HandleResolver,
  type HandleResolverErrorHandler,
  type ResolveHandleOptions,
  type ResolvedHandle,
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

  /**
   * Optional observability hook, invoked when resolution fails for a non-abort
   * reason (network error, SSRF block, non-2xx response, redirect, etc.). The
   * resolver still returns `null` per its contract; this only exposes the cause
   * for logging, telemetry, or surfacing a specific failure to end users.
   *
   * Configuring it on the instance (rather than per call) means it also covers
   * resolution performed internally on your behalf, e.g. by an OAuth client.
   */
  onError?: HandleResolverErrorHandler
}

export class WellKnownHandleResolver implements HandleResolver {
  protected readonly fetch: typeof globalThis.fetch
  protected readonly onError?: HandleResolverErrorHandler

  constructor(options?: WellKnownHandleResolverOptions) {
    this.fetch = options?.fetch ?? globalThis.fetch
    this.onError = options?.onError
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

      // A non-2xx response (e.g. 5xx upstream, 4xx misconfigured endpoint) is
      // not a resolution success, but fetch() does not throw on it. Route it
      // through the same catch path so an onError handler sees operational
      // failures, not just transport-level errors.
      if (!response.ok) {
        throw new HandleResolverError(
          `Resolver returned HTTP ${response.status} for ${url.origin}/.well-known/atproto-did`,
        )
      }

      const text = await response.text()
      const firstLine = text.split('\n')[0]!.trim()

      if (isResolvedHandle(firstLine)) return firstLine

      return null
    } catch (err) {
      // If the abort signal fired, propagate that to the caller. Otherwise the
      // request failed for a reason that prevents resolution (network error,
      // SSRF block, 5xx, redirect, etc.). We still return null per the resolver
      // contract, but expose the cause through onError so callers can tell "no
      // .well-known endpoint exists" apart from operational failures.
      options?.signal?.throwIfAborted()

      // Observational only: a throwing handler must not change the return
      // contract, so isolate it in its own catch.
      if (this.onError) {
        try {
          this.onError(err, { resolver: 'well-known', handle })
        } catch {
          // Ignore errors from the observability handler.
        }
      }

      return null
    }
  }
}

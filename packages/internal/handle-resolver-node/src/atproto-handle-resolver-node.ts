import { type Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'
import {
  AtprotoHandleResolver,
  type HandleResolver,
  type HandleResolverErrorHandler,
} from '@atproto-labs/handle-resolver'
import {
  nodeResolveTxtDefault,
  nodeResolveTxtFactory,
} from './node-resolve-txt-factory.js'

export type AtprotoHandleResolverNodeOptions = {
  /**
   * List of backup nameservers to use in case the primary ones fail. Will
   * default to no fallback nameservers.
   */
  fallbackNameservers?: string[]

  /**
   * Fetch function to use for HTTP requests. Allows customizing the request
   * behavior, e.g. adding headers, setting a timeout, mocking, etc. The
   * provided fetch function will be wrapped with a safeFetchWrap function that
   * adds SSRF protection.
   *
   * @default `globalThis.fetch`
   * @note Ignored if {@link AtprotoHandleResolverNodeOptions.safeFetch safeFetch} is provided.
   */
  fetch?: Fetch

  /**
   * Allows to provide a custom safe fetch function, which will be used for HTTP
   * requests with SSRF protection and other safety measures applied.
   *
   * @default `safeFetchWrap({ fetch, timeout: 3000, ssrfProtection: true, responseMaxSize: 10 * 1048 })`
   */
  safeFetch?: Fetch

  /**
   * Optional observability hook, invoked when handle resolution fails for a
   * non-abort reason (network error, SSRF block, non-2xx response, etc.). The
   * resolver still returns `null`; this only exposes the cause for logging or
   * telemetry. Handy for diagnosing why a handle fails to resolve, e.g. when a
   * PDS sits behind a firewall that trips SSRF protection.
   */
  onError?: HandleResolverErrorHandler
}

export class AtprotoHandleResolverNode
  extends AtprotoHandleResolver
  implements HandleResolver
{
  constructor({
    fetch = globalThis.fetch,
    safeFetch = safeFetchWrap({
      fetch,
      timeout: 3000, // 3 seconds
      ssrfProtection: true,
      responseMaxSize: 10 * 1048, // DID are max 2048 characters, 10kb for safety
    }),
    fallbackNameservers,
    onError,
  }: AtprotoHandleResolverNodeOptions = {}) {
    super({
      fetch: safeFetch,
      resolveTxt: nodeResolveTxtDefault,
      resolveTxtFallback: fallbackNameservers?.length
        ? nodeResolveTxtFactory(fallbackNameservers)
        : undefined,
      onError,
    })
  }
}

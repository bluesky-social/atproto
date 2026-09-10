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
   * behavior, e.g. adding headers, setting a timeout, mocking, etc. This will
   * be wrapped with {@link safeFetchWrap} to build the {@link safeFetch} when
   * it is not provided.
   *
   * @default `globalThis.fetch`
   */
  fetch?: Fetch

  /**
   * Custom fetch function that will be used for HTTP requests. This function,
   * if provided, *must* be safe to use with user-provided input (URL). If not
   * provided, a safe fetch function will be created by wrapping the provided {@link fetch}
   * function (or the default `globalThis.fetch`) with {@link safeFetchWrap}.
   *
   * @see {@link safeFetchWrap}
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
      responseMaxSize: 10 * 1024, // DID are max 2048 characters, 10kb for safety
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

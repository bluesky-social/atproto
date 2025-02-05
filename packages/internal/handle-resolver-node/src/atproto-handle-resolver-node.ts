import { Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'
import {
  AtprotoHandleResolver,
  HandleResolver,
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
   */
  fetch?: Fetch
}

export class AtprotoHandleResolverNode
  extends AtprotoHandleResolver
  implements HandleResolver
{
  constructor({
    fetch = globalThis.fetch,
    fallbackNameservers,
  }: AtprotoHandleResolverNodeOptions = {}) {
    super({
      fetch: safeFetchWrap({
        fetch,
        timeout: 3000, // 3 seconds
        ssrfProtection: true,
        responseMaxSize: 10 * 1048, // DID are max 2048 characters, 10kb for safety
      }),
      resolveTxt: nodeResolveTxtDefault,
      resolveTxtFallback: fallbackNameservers?.length
        ? nodeResolveTxtFactory(fallbackNameservers)
        : undefined,
    })
  }
}

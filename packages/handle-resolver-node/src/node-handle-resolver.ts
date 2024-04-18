import { Fetch } from '@atproto-labs/fetch'
import { SafeFetchWrapOptions, safeFetchWrap } from '@atproto-labs/fetch-node'
import {
  CachedHandleResolver,
  CachedHandleResolverOptions,
  HandleResolver,
  WellKnownHandleResolver,
} from '@atproto-labs/handle-resolver'

import {
  DnsHandleResolver,
  DnsHandleResolverOptions,
} from './dns-handle-resolver.js'

export type NodeHandleResolverOptions = {
  /**
   * List of domain names that are forbidden to be resolved using the
   * well-known/atproto-did method.
   */
  wellKnownExclude?: SafeFetchWrapOptions['forbiddenDomainNames']

  /**
   * List of backup nameservers to use for DNS resolution.
   */
  fallbackNameservers?: DnsHandleResolverOptions['nameservers']

  cache?: CachedHandleResolverOptions['cache']

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

export class NodeHandleResolver
  extends CachedHandleResolver
  implements HandleResolver
{
  constructor({
    cache,
    fetch = globalThis.fetch,
    fallbackNameservers,
    wellKnownExclude,
  }: NodeHandleResolverOptions = {}) {
    const safeFetch = safeFetchWrap({
      fetch,
      timeout: 3000, // 3 seconds
      forbiddenDomainNames: wellKnownExclude,
      ssrfProtection: true,
      responseMaxSize: 10 * 1048, // DID are max 2048 characters, 10kb for safety
    })

    const httpResolver = new WellKnownHandleResolver({
      fetch: safeFetch,
    })

    const dnsResolver = new DnsHandleResolver()

    const fallbackResolver = new DnsHandleResolver({
      nameservers: fallbackNameservers,
    })

    super({
      cache,
      resolver: {
        resolve: async (handle) => {
          const abortController = new AbortController()

          const dnsPromise = dnsResolver.resolve(handle)
          const httpPromise = httpResolver.resolve(handle, {
            signal: abortController.signal,
          })

          // Will be awaited later
          httpPromise.catch(() => {})

          const dnsRes = await dnsPromise
          if (dnsRes) {
            abortController.abort()
            return dnsRes
          }

          const res = await httpPromise
          if (res) return res

          return fallbackResolver.resolve(handle)
        },
      },
    })
  }
}

import { Fetch } from '@atproto/fetch'
import { SafeFetchWrapOptions, safeFetchWrap } from '@atproto/fetch-node'
import {
  CachedHandleResolver,
  CachedHandleResolverOptions,
  HandleResolver,
  ParallelHandleResolver,
  WellKnownHandleResolver,
} from '@atproto/handle-resolver'

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
  dnsBackupNameservers?: DnsHandleResolverOptions['backupNameservers']
  dnsExclude?: DnsHandleResolverOptions['exclude']

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
    dnsBackupNameservers,
    dnsExclude,
    wellKnownExclude,
  }: NodeHandleResolverOptions = {}) {
    const safeFetch = safeFetchWrap({
      fetch,
      timeout: 3000, // 3 seconds
      forbiddenDomainNames: wellKnownExclude,
      ssrfProtection: true,
      responseMaxSize: 10 * 1048, // DID are max 2048 characters, 10kb for safety
    })

    const resolver = new ParallelHandleResolver([
      new DnsHandleResolver({
        backupNameservers: dnsBackupNameservers,
        exclude: dnsExclude,
      }),
      new WellKnownHandleResolver({
        fetch: safeFetch,
      }),
    ])

    super({
      cache,
      resolver,
    })
  }
}

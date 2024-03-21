import { GenericStore } from '@atproto/caching'
import { Fetch } from '@atproto/fetch'

import { CachedHandleResolver } from './cached-handle-resolver.js'
import { HandleResolveValue, HandleResolver } from './handle-resolver.js'
import { PublicXrpcHandleResolver } from './public-xrpc-handle-resolver.js'
import { SerialHandleResolver } from './serial-handle-resolver.js'
import { WellKnownHandleResolver } from './well-known-handler-resolver.js'

export type HandleResolverCache = GenericStore<string, HandleResolveValue>

export type IsomorphicHandleResolverOptions = {
  cache?: HandleResolverCache

  /**
   * Fetch function to use for HTTP requests. Allows customizing the request
   * behavior, e.g. adding headers, setting a timeout, mocking, etc.
   *
   * When using this library from a Node.js environment, you may want to use
   * `safeFetchWrap()` from `@atproto/fetch-node` to add SSRF protection.
   *
   * @default `globalThis.fetch`
   */
  fetch?: Fetch
}

export class IsomorphicHandleResolver
  extends CachedHandleResolver
  implements HandleResolver
{
  constructor({
    fetch = globalThis.fetch,
    cache,
  }: IsomorphicHandleResolverOptions = {}) {
    const resolver = new SerialHandleResolver([
      new WellKnownHandleResolver({ fetch }),
      new PublicXrpcHandleResolver({ fetch }),
    ])

    super({ resolver, cache })
  }
}

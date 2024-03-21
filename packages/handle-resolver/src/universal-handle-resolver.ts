import { GenericStore } from '@atproto/caching'
import { Fetch } from '@atproto/fetch'

import { CachedHandleResolver } from './cached-handle-resolver.js'
import { HandleResolver, ResolvedHandle } from './handle-resolver.js'
import { PublicXrpcHandleResolver } from './public-xrpc-handle-resolver.js'
import { SerialHandleResolver } from './serial-handle-resolver.js'
import { WellKnownHandleResolver } from './well-known-handler-resolver.js'

export type HandleResolverCache = GenericStore<string, ResolvedHandle>

export type UniversalHandleResolverOptions = {
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

/**
 * A handle resolver that works in any environment that supports `fetch()`. This
 * relies on the a public XRPC implementing "com.atproto.identity.resolveHandle"
 * to resolve handles.
 */
export class UniversalHandleResolver
  extends CachedHandleResolver
  implements HandleResolver
{
  constructor({
    fetch = globalThis.fetch,
    cache,
  }: UniversalHandleResolverOptions = {}) {
    const resolver = new SerialHandleResolver([
      // Try the well-known method first, allowing to reduce the load on the
      // XRPC.
      new WellKnownHandleResolver({ fetch }),
      new PublicXrpcHandleResolver({ fetch }),
    ])

    super({ resolver, cache })
  }
}

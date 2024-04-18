import { GenericStore } from '@atproto-labs/caching'
import { Fetch } from '@atproto-labs/fetch'

import { CachedHandleResolver } from './cached-handle-resolver.js'
import { HandleResolver, ResolvedHandle } from './handle-resolver.js'
import {
  AtprotoLexiconHandleResolver,
  AtprotoLexiconHandleResolverOptions,
} from './atproto-lexicon-handle-resolver.js'
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
   * `safeFetchWrap()` from `@atproto-labs/fetch-node` to add SSRF protection.
   *
   * @default `globalThis.fetch`
   */
  fetch?: Fetch

  /**
   * @see {@link AtprotoLexiconHandleResolverOptions.url}
   */
  atprotoLexiconUrl?: AtprotoLexiconHandleResolverOptions['url']
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
    atprotoLexiconUrl,
  }: UniversalHandleResolverOptions = {}) {
    const resolver = new SerialHandleResolver([
      // Try the well-known method first, allowing to reduce the load on the
      // XRPC.
      new WellKnownHandleResolver({ fetch }),
      new AtprotoLexiconHandleResolver({ fetch, url: atprotoLexiconUrl }),
    ])

    super({ resolver, cache })
  }
}

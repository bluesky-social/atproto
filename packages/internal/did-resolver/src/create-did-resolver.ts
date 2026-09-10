import type { AtprotoIdentityDidMethods } from '@atproto/did'
import { DidCacheMemory } from './did-cache-memory.js'
import {
  type DidCache,
  type DidCacheErrorHandler,
  DidResolverCached,
} from './did-cache.js'
import {
  DidResolverCommon,
  type DidResolverCommonOptions,
} from './did-resolver-common.js'
import type { DidResolver } from './did-resolver.js'

export type { AtprotoIdentityDidMethods }

export type CreateDidResolverOptions = {
  didResolver?: DidResolver<AtprotoIdentityDidMethods>
  /**
   * Custom cache for resolved DIDs. If not provided, the resolver will use an
   * in-memory cache ({@link DidCacheMemory}).
   */
  didCache?: DidCache
  onDidCacheError?: DidCacheErrorHandler
} & Partial<DidResolverCommonOptions>

export function createDidResolver(
  options: CreateDidResolverOptions = {},
): DidResolver<AtprotoIdentityDidMethods> {
  const { didResolver, didCache, onDidCacheError } = options

  if (didResolver instanceof DidResolverCached && !didCache) {
    return didResolver
  }

  return new DidResolverCached(
    didResolver ?? new DidResolverCommon(options),
    didCache ?? new DidCacheMemory(),
    onDidCacheError,
  )
}

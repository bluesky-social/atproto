import type { AtprotoIdentityDidMethods } from '@atproto/did'
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
  didCache?: DidCache
  onDidCacheError?: DidCacheErrorHandler
} & Partial<DidResolverCommonOptions>

export function createDidResolver(
  options: CreateDidResolverOptions,
): DidResolver<AtprotoIdentityDidMethods> {
  const { didResolver, didCache, onDidCacheError } = options

  if (didResolver instanceof DidResolverCached && !didCache) {
    return didResolver
  }

  return new DidResolverCached(
    didResolver ?? new DidResolverCommon(options),
    didCache,
    onDidCacheError,
  )
}

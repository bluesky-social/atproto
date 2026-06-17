import { AtprotoIdentityDidMethods } from '@atproto/did'
import { DidCache, DidResolverCached } from './did-cache.js'
import {
  DidResolverCommon,
  DidResolverCommonOptions,
} from './did-resolver-common.js'
import { DidResolver } from './did-resolver.js'

export type { AtprotoIdentityDidMethods }

export type CreateDidResolverOptions = {
  didResolver?: DidResolver<AtprotoIdentityDidMethods>
  didCache?: DidCache
} & Partial<DidResolverCommonOptions>

export function createDidResolver(
  options: CreateDidResolverOptions,
): DidResolver<AtprotoIdentityDidMethods> {
  const { didResolver, didCache } = options

  if (didResolver instanceof DidResolverCached && !didCache) {
    return didResolver
  }

  return new DidResolverCached(
    didResolver ?? new DidResolverCommon(options),
    didCache,
  )
}

import type { Did, DidDocument } from '@atproto/did'
import {
  CachedGetter,
  type SimpleStore,
  type StoreErrorHandler,
  swallowStoreErrors,
} from '@atproto-labs/simple-store'
import { DidCacheMemory } from './did-cache-memory.js'
import type { DidMethod, ResolveDidOptions } from './did-method.js'
import type { DidResolver, ResolvedDocument } from './did-resolver.js'

export type { DidMethod, ResolveDidOptions, ResolvedDocument }

export type DidCache = SimpleStore<Did, DidDocument>

/**
 * Called when the {@link DidCache} throws. The cache is treated as best-effort:
 * failures are logged (by default) and degrade to a cache miss + resolution
 * from the underlying resolver, rather than being propagated.
 */
export type DidCacheErrorHandler = StoreErrorHandler<Did>

export type DidResolverCachedOptions = {
  cache?: DidCache
  onDidCacheError?: DidCacheErrorHandler
}

export class DidResolverCached<
  M extends string = string,
> implements DidResolver<M> {
  protected readonly getter: CachedGetter<Did, DidDocument>
  constructor(
    resolver: DidResolver<M>,
    cache: DidCache = new DidCacheMemory(),
    onDidCacheError?: DidCacheErrorHandler,
  ) {
    this.getter = new CachedGetter<Did, DidDocument>(
      (did, options) => resolver.resolve(did, options),
      swallowStoreErrors(cache, onDidCacheError),
    )
  }

  public async resolve<D extends Did>(did: D, options?: ResolveDidOptions) {
    return this.getter.get(did, options) as Promise<ResolvedDocument<D, M>>
  }
}

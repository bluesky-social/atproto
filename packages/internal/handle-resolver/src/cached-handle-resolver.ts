import {
  CachedGetter,
  type SimpleStore,
  type StoreErrorHandler,
  swallowStoreErrors,
} from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import type {
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
} from './types.js'

export type HandleCache = SimpleStore<string, ResolvedHandle>

/**
 * Called when the {@link HandleCache} throws. The cache is treated as
 * best-effort: failures are logged (by default) and degrade to a cache miss +
 * resolution from the underlying resolver, rather than being propagated.
 */
export type HandleCacheErrorHandler = StoreErrorHandler<string>

export class CachedHandleResolver implements HandleResolver {
  private getter: CachedGetter<string, ResolvedHandle>

  constructor(
    /**
     * The resolver that will be used to resolve handles.
     */
    resolver: HandleResolver,
    cache: HandleCache = new SimpleStoreMemory<string, ResolvedHandle>({
      max: 1000,
      ttl: 10 * 60e3,
    }),
    onHandleCacheError?: HandleCacheErrorHandler,
  ) {
    this.getter = new CachedGetter<string, ResolvedHandle>(
      (handle, options) => resolver.resolve(handle, options),
      swallowStoreErrors(cache, onHandleCacheError),
    )
  }

  async resolve(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    return this.getter.get(handle, options)
  }
}

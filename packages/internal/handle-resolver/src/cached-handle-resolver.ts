import { CachedGetter, SimpleStore } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import {
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
} from './types.js'

export type HandleCache = SimpleStore<string, ResolvedHandle>

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
  ) {
    this.getter = new CachedGetter<string, ResolvedHandle>(
      (handle, options) => resolver.resolve(handle, options),
      cache,
    )
  }

  async resolve(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    return this.getter.get(handle, options)
  }
}

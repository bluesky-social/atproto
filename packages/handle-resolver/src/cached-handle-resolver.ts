import { CachedGetter, GenericStore, MemoryStore } from '@atproto/caching'
import {
  HandleResolveOptions,
  HandleResolver,
  ResolvedHandle,
} from './handle-resolver.js'

export type CachedHandleResolverOptions = {
  /**
   * The resolver that will be used to resolve handles.
   */
  resolver: HandleResolver

  /**
   * A store that will be used to cache resolved values.
   */
  cache?: GenericStore<string, ResolvedHandle>
}

export class CachedHandleResolver
  extends CachedGetter<string, ResolvedHandle>
  implements HandleResolver
{
  constructor({
    resolver,
    cache = new MemoryStore<string, ResolvedHandle>({
      max: 1000,
      ttl: 10 * 60e3,
    }),
  }: CachedHandleResolverOptions) {
    super((handle, options) => resolver.resolve(handle, options), cache)
  }

  async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<ResolvedHandle> {
    return this.get(handle, options)
  }
}

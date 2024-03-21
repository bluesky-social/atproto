import { CachedGetter, GenericStore, MemoryStore } from '@atproto/caching'
import {
  HandleResolveOptions,
  HandleResolveValue,
  HandleResolver,
} from './handle-resolver.js'

export type CachedHandleResolverOptions = {
  /**
   * The resolver that will be used to resolve handles.
   */
  resolver: HandleResolver

  /**
   * A store that will be used to cache resolved values.
   */
  cache?: GenericStore<string, HandleResolveValue>
}

export class CachedHandleResolver implements HandleResolver {
  #getter: CachedGetter<string, HandleResolveValue>

  constructor({
    resolver,
    cache = new MemoryStore<string, HandleResolveValue>({
      max: 1000,
      ttl: 10 * 60e3,
    }),
  }: CachedHandleResolverOptions) {
    this.#getter = new CachedGetter<string, HandleResolveValue>(
      (handle, options) => resolver.resolve(handle, options),
      cache,
    )
  }

  async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<HandleResolveValue> {
    return this.#getter.get(handle, options)
  }
}

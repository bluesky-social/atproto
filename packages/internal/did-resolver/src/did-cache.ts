import { Did, DidDocument } from '@atproto/did'
import { CachedGetter, SimpleStore } from '@atproto-labs/simple-store'
import { DidCacheMemory } from './did-cache-memory.js'
import { DidMethod, ResolveDidOptions } from './did-method.js'
import { DidResolver, ResolvedDocument } from './did-resolver.js'

export type { DidMethod, ResolveDidOptions, ResolvedDocument }

export type DidCache = SimpleStore<Did, DidDocument>

export type DidResolverCachedOptions = { cache?: DidCache }

export class DidResolverCached<M extends string = string>
  implements DidResolver<M>
{
  protected readonly getter: CachedGetter<Did, DidDocument>
  constructor(
    resolver: DidResolver<M>,
    cache: DidCache = new DidCacheMemory(),
  ) {
    this.getter = new CachedGetter<Did, DidDocument>(
      (did, options) => resolver.resolve(did, options),
      cache,
    )
  }

  public async resolve<D extends Did>(did: D, options?: ResolveDidOptions) {
    return this.getter.get(did, options) as Promise<ResolvedDocument<D, M>>
  }
}

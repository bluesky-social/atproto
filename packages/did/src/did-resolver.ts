import { CachedGetter } from '@atproto/simple-store'
import { DidCacheMemory } from './did-cache-memory.js'
import { DidCache } from './did-cache.js'
import { DidDocument } from './did-document.js'
import { DidMethod, DidMethods, ResolveOptions } from './did-method.js'
import { DidResolverBase, ResolvedDocument } from './did-resolver-base.js'
import { Did } from './did.js'

export type { DidMethod, ResolveOptions, ResolvedDocument }

export type DidResolverOptions = {
  cache?: DidCache
}

export class DidResolver<M extends string = string> extends DidResolverBase<M> {
  readonly #getter: CachedGetter<Did, DidDocument>

  constructor(methods: DidMethods<M>, options?: DidResolverOptions) {
    super(methods)

    this.#getter = new CachedGetter<Did, DidDocument>(
      (did, options) => super.resolve(did, options),
      options?.cache ?? new DidCacheMemory(),
    )
  }

  async resolve<D extends Did>(
    did: D,
    options?: ResolveOptions,
  ): Promise<ResolvedDocument<D, M>>
  async resolve(did: Did, options?: ResolveOptions): Promise<DidDocument> {
    return this.#getter.get(did, options)
  }
}

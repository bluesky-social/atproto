import { CachedGetter } from '@atproto-labs/simple-store'
import { Did, DidDocument } from '@atproto/did'

import { DidCacheMemory } from './did-cache-memory.js'
import { DidCache } from './did-cache.js'
import { DidMethod, ResolveOptions } from './did-method.js'
import { DidResolverBase, ResolvedDocument } from './did-resolver-base.js'
import { DidPlcMethod, DidPlcMethodOptions } from './methods/plc.js'
import { DidWebMethod, DidWebMethodOptions } from './methods/web.js'
import { Simplify } from './util.js'

export type { DidMethod, ResolveOptions, ResolvedDocument }

export type MethodsOptions = Simplify<DidPlcMethodOptions & DidWebMethodOptions>
export type DidResolverOptions = Simplify<{ cache?: DidCache } & MethodsOptions>

export class DidResolver extends DidResolverBase<'plc' | 'web'> {
  private readonly getter: CachedGetter<Did, DidDocument>

  constructor({
    cache = new DidCacheMemory(),
    ...methodsOptions
  }: DidResolverOptions = {}) {
    super({
      plc: new DidPlcMethod(methodsOptions),
      web: new DidWebMethod(methodsOptions),
    })

    this.getter = new CachedGetter<Did, DidDocument>(
      (did, options) => super.resolve(did, options),
      cache,
    )
  }

  async resolve<D extends Did>(
    did: D,
    options?: ResolveOptions,
  ): Promise<ResolvedDocument<D, 'plc' | 'web'>> {
    return this.getter.get(did, options) as Promise<
      ResolvedDocument<D, 'plc' | 'web'>
    >
  }
}

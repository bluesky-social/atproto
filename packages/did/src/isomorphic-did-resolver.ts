import { DidCache } from './did-cache.js'
import { DidResolver } from './did-resolver.js'

import { DidPlcMethod, DidPlcMethodOptions } from './methods/plc.js'
import { DidWebMethod, DidWebMethodOptions } from './methods/web.js'

export type { DidCache }
export type IsomorphicDidResolverOptions = DidPlcMethodOptions &
  DidWebMethodOptions & {
    cache?: DidCache
  }

export class IsomorphicDidResolver extends DidResolver<'plc' | 'web'> {
  constructor({ cache, ...options }: IsomorphicDidResolverOptions = {}) {
    super(
      {
        plc: new DidPlcMethod(options),
        web: new DidWebMethod(options),
      },
      { cache },
    )
  }
}

import { DidWebResolver } from './web-resolver'
import { DidPlcResolver } from './plc-resolver'
import { DidResolverOpts } from './types'
import BaseResolver from './base-resolver'
import { PoorlyFormattedDidError, UnsupportedDidMethodError } from './errors'
import { DidCache } from './did-cache'

export class DidResolver extends BaseResolver {
  methods: Record<string, BaseResolver>

  constructor(opts: Partial<DidResolverOpts> = {}, cache?: DidCache) {
    super(cache)
    const { timeout = 3000, plcUrl = 'https://plc.directory' } = opts
    // do not pass cache to sub-methods or we will be double caching
    this.methods = {
      plc: new DidPlcResolver({ timeout, plcUrl }),
      web: new DidWebResolver({ timeout }),
    }
  }

  async resolveDidNoCheck(did: string): Promise<unknown> {
    const split = did.split(':')
    if (split[0] !== 'did') {
      throw new PoorlyFormattedDidError(did)
    }
    const method = this.methods[split[1]]
    if (!method) {
      throw new UnsupportedDidMethodError(did)
    }
    return method.resolveDidNoCheck(did)
  }
}

export default DidResolver

import { DidWebResolver } from './web-resolver'
import { DidPlcResolver } from './plc-resolver'
import { DidResolverOpts } from '../types'
import BaseResolver from './base-resolver'
import { PoorlyFormattedDidError, UnsupportedDidMethodError } from '../errors'

export class DidResolver extends BaseResolver {
  methods: Record<string, BaseResolver>

  constructor(opts: DidResolverOpts) {
    super(opts.didCache)
    const { timeout = 3000, plcUrl = 'https://plc.directory' } = opts
    // do not pass cache to sub-methods or we will be double caching
    this.methods = {
      plc: new DidPlcResolver(plcUrl, timeout),
      web: new DidWebResolver(timeout),
    }
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    const split = did.split(':')
    if (split[0] !== 'did') {
      throw new PoorlyFormattedDidError(did)
    }
    const method = this.methods[split[1]]
    if (!method) {
      throw new UnsupportedDidMethodError(did)
    }
    return method.resolveNoCheck(did)
  }
}

export default DidResolver

import { PoorlyFormattedDidError, UnsupportedDidMethodError } from '../errors'
import { DidResolverOpts } from '../types'
import { BaseResolver } from './base-resolver'
import { DidPlcResolver } from './plc-resolver'
import { DidWebResolver } from './web-resolver'

export class DidResolver extends BaseResolver {
  methods: Map<string, BaseResolver>

  constructor(opts: DidResolverOpts) {
    super(opts.didCache)
    const { timeout = 3000, plcUrl = 'https://plc.directory' } = opts
    // do not pass cache to sub-methods or we will be double caching
    this.methods = new Map([
      ['plc', new DidPlcResolver(plcUrl, timeout)],
      ['web', new DidWebResolver(timeout)],
    ])
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    if (!did.startsWith('did:')) {
      throw new PoorlyFormattedDidError(did)
    }
    const methodSepIdx = did.indexOf(':', 4)
    if (methodSepIdx === -1) {
      throw new PoorlyFormattedDidError(did)
    }
    const methodName = did.slice(4, methodSepIdx)
    const method = this.methods.get(methodName)
    if (!method) {
      throw new UnsupportedDidMethodError(did)
    }
    return method.resolveNoCheck(did)
  }
}

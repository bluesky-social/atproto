import { DidWebResolver } from './web-resolver'
import { DidPlcResolver } from './plc-resolver'
import { DidResolverOpts } from './types'
import BaseResolver from './base-resolver'
import { PoorlyFormattedDidError, UnsupportedDidMethodError } from './errors'

export class DidResolver extends BaseResolver {
  methods: Record<string, BaseResolver>

  constructor(opts: Partial<DidResolverOpts> = {}) {
    super()
    const { timeout = 3000, plcUrl = 'https://plc.directory' } = opts
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

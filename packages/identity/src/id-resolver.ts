import { DidResolver } from './did/did-resolver.js'
import { HandleResolver } from './handle/index.js'
import type { IdentityResolverOpts } from './types.js'

export class IdResolver {
  public handle: HandleResolver
  public did: DidResolver

  constructor(opts: IdentityResolverOpts = {}) {
    const { timeout = 3000, plcUrl, didCache } = opts
    this.handle = new HandleResolver({
      timeout,
      backupNameservers: opts.backupNameservers,
    })
    this.did = new DidResolver({ timeout, plcUrl, didCache })
  }
}

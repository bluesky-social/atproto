import { DidResolver } from './did/did-resolver'
import { HandleResolver } from './handle'
import { IdentityResolverOpts } from './types'

export class IdResolver {
  public handle: HandleResolver
  public did: DidResolver

  constructor(opts: IdentityResolverOpts = {}) {
    const { fetch = globalThis.fetch, timeout = 3000, plcUrl, didCache } = opts
    this.handle = new HandleResolver({
      fetch,
      timeout,
      backupNameservers: opts.backupNameservers,
    })
    this.did = new DidResolver({ fetch, timeout, plcUrl, didCache })
  }
}

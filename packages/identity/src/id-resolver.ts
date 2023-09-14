import { HandleResolver } from './handle'
import DidResolver from './did/did-resolver'
import { IdentityResolverOpts } from './types'

/**
 * Wrapper of a DID resolver and handle resolver.
 *
 * Calling code is responsible for cross-validate handle/DID pairing.
 */
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

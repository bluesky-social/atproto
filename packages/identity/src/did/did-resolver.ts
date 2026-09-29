import type { Fetch } from '@atproto-labs/fetch-node'
import {
  PoorlyFormattedDidError,
  UnsupportedDidMethodError,
} from '../errors.js'
import { createDefaultFetch } from '../fetch.js'
import type { DidResolverOpts } from '../types.js'
import { BaseResolver } from './base-resolver.js'
import { DidPlcResolver } from './plc-resolver.js'
import { DidWebResolver } from './web-resolver.js'

export class DidResolver extends BaseResolver {
  methods: Map<string, BaseResolver>

  constructor(opts: DidResolverOpts) {
    super(opts.didCache)
    const { timeout = 3000, plcUrl = 'https://plc.directory' } = opts
    // One fetch instance shared by both methods.
    const fetch: Fetch = opts.fetch ?? createDefaultFetch()
    // do not pass cache to sub-methods or we will be double caching
    // @NOTE Explicit generic arg: tsc otherwise tries to unify the two
    // resolver types instead of widening to BaseResolver.
    this.methods = new Map<string, BaseResolver>([
      ['plc', new DidPlcResolver(plcUrl, timeout, undefined, fetch)],
      ['web', new DidWebResolver(timeout, undefined, fetch)],
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

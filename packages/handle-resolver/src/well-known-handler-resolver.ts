import { isDid } from '@atproto/did'
import { Fetch } from '@atproto/fetch'

import {
  HandleResolveOptions,
  HandleResolveValue,
  HandleResolver,
} from './handle-resolver.js'

export type WellKnownHandleResolverOptions = {
  fetch?: Fetch
}

export class WellKnownHandleResolver implements HandleResolver {
  protected readonly fetch: Fetch

  constructor({
    fetch = globalThis.fetch,
  }: WellKnownHandleResolverOptions = {}) {
    this.fetch = fetch
  }

  public async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<HandleResolveValue> {
    const url = new URL('/.well-known/atproto-did', `https://${handle}`)

    const headers = new Headers()
    if (options?.noCache) headers.set('cache-control', 'no-cache')
    const request = new Request(url, { headers, signal: options?.signal })
    const res = await this.fetch.call(globalThis, request)
    if (res.ok) {
      const did = (await res.text()).split('\n')[0]?.trim()

      if (!isDid(did, ['plc', 'web'])) {
        throw new Error('Invalid DID returned from xrpc')
      }

      return did
    }

    throw new Error('Failed to resolve handle')
  }
}

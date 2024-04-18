import { Fetch } from '@atproto-labs/fetch'

import {
  HandleResolveOptions,
  HandleResolver,
  ResolvedHandle,
  isResolvedHandle,
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
  ): Promise<ResolvedHandle> {
    const url = new URL('/.well-known/atproto-did', `https://${handle}`)

    const headers = new Headers()
    if (options?.noCache) headers.set('cache-control', 'no-cache')
    const request = new Request(url, { headers, signal: options?.signal })

    try {
      const response = await (0, this.fetch)(request)
      const text = await response.text()
      const firstLine = text.split('\n')[0]!.trim()

      if (isResolvedHandle(firstLine)) return firstLine

      return null
    } catch (err) {
      // The the request failed, assume the handle does not resolve to a DID,
      // unless the failure was due to the signal being aborted.
      options?.signal?.throwIfAborted()

      // TODO: propagate some errors as-is (?)

      return null
    }
  }
}

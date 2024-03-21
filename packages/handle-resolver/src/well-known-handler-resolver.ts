import { Fetch, FetchResponseError } from '@atproto/fetch'

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
      const response = await this.fetch.call(globalThis, request)
      const text = await response.text()
      const firstLine = text.split('\n')[0]!.trim()

      if (isResolvedHandle(firstLine)) return firstLine

      // If a web server is present at the handle's domain, it could return
      // any response. Only payload that start with "did:" but are not a
      // valid DID are considered unexpected behavior.
      if (firstLine.startsWith('did:')) {
        throw new FetchResponseError(
          502,
          'Invalid DID returned from well-known method',
          { request, response },
        )
      }

      // Any other response is considered as a positive indication that the
      // handle does not resolve to a DID using the well-known method.
      return null
    } catch {
      // The the request failed, assume the handle does not resolve to a DID,
      // unless the failure was due to the signal being aborted.
      options?.signal?.throwIfAborted()

      return null
    }
  }
}

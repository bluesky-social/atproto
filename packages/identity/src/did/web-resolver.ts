import type { Fetch } from '@atproto-labs/fetch-node'
import {
  PoorlyFormattedDidError,
  UnsupportedDidWebPathError,
} from '../errors.js'
import { createDefaultFetch } from '../fetch.js'
import type { DidCache } from '../types.js'
import { BaseResolver } from './base-resolver.js'

export const DOC_PATH = '/.well-known/did.json'

export class DidWebResolver extends BaseResolver {
  private fetch: Fetch

  constructor(
    public timeout: number,
    public cache?: DidCache,
    fetch?: Fetch,
  ) {
    super(cache)
    this.fetch = fetch ?? createDefaultFetch()
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    const parsedId = did.split(':').slice(2).join(':')
    const parts = parsedId.split(':').map(decodeURIComponent)
    let path: string
    if (parts.length < 1) {
      throw new PoorlyFormattedDidError(did)
    } else if (parts.length === 1) {
      path = parts[0] + DOC_PATH
    } else {
      // how we *would* resolve a did:web with path, if atproto supported it
      //path = parts.join('/') + '/did.json'
      throw new UnsupportedDidWebPathError(did)
    }

    const url = new URL(`https://${path}`)
    if (url.hostname === 'localhost') {
      // @NOTE Inert under the default (SSRF-protected) fetch, which rejects
      // http: and private addresses. Retained because it is what makes
      // did:web:localhost%3A<port> resolvable when a fetch is injected.
      url.protocol = 'http'
    }

    const res = await this.fetch.call(null, url, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: AbortSignal.timeout(this.timeout),
    })

    // Positively not found, versus due to e.g. network error
    if (!res.ok) {
      await res.body?.cancel()
      return null
    }

    return res.json()
  }
}

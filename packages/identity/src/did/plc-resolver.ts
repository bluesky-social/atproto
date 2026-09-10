import type { Fetch } from '@atproto-labs/fetch-node'
import { createDefaultFetch } from '../fetch.js'
import type { DidCache } from '../types.js'
import { BaseResolver } from './base-resolver.js'

export class DidPlcResolver extends BaseResolver {
  private fetch: Fetch

  constructor(
    public plcUrl: string,
    public timeout: number,
    public cache?: DidCache,
    fetch?: Fetch,
  ) {
    super(cache)
    this.fetch = fetch ?? createDefaultFetch()
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    const url = new URL(`/${encodeURIComponent(did)}`, this.plcUrl)
    const res = await this.fetch.call(null, url, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: AbortSignal.timeout(this.timeout),
    })

    // Positively not found, versus due to e.g. network error
    if (res.status === 404) {
      await res.body?.cancel()
      return null
    }

    if (!res.ok) {
      await res.body?.cancel()
      throw Object.assign(new Error(res.statusText), { status: res.status })
    }

    return res.json()
  }
}

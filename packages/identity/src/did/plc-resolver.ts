import { DidCache } from '../types'
import { BaseResolver } from './base-resolver'
import { timed } from './util'

export class DidPlcResolver extends BaseResolver {
  constructor(
    public plcUrl: string,
    public timeout: number,
    public cache?: DidCache,
  ) {
    super(cache)
  }

  async resolveNoCheck(did: string): Promise<unknown> {
    return timed(this.timeout, async (signal) => {
      const url = new URL(`/${encodeURIComponent(did)}`, this.plcUrl)
      const res = await fetch(url, {
        redirect: 'error',
        headers: { accept: 'application/did+ld+json,application/json' },
        signal,
      })

      // Positively not found, versus due to e.g. network error
      if (res.status === 404) return null

      if (!res.ok) {
        throw Object.assign(new Error(res.statusText), { status: res.status })
      }

      return res.json()
    })
  }
}

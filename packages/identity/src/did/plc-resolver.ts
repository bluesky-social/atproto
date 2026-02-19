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
        redirect: 'manual',
        headers: { accept: 'application/did+ld+json,application/json' },
        signal,
      })

      // Positively not found, versus due to e.g. network error
      if (res.status === 404) return null

      // Using 'manual' mode: treat opaqueredirect or 3xx responses as redirects
      if (
        res.type === 'opaqueredirect' ||
        (res.status >= 300 && res.status < 400)
      ) {
        throw Object.assign(new Error('redirected'), {
          status: res.status || 302,
        })
      }

      if (!res.ok) {
        throw Object.assign(new Error(res.statusText), { status: res.status })
      }

      return res.json()
    })
  }
}

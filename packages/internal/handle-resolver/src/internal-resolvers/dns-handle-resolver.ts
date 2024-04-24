import { HandleResolver, ResolvedHandle, isResolvedHandle } from '../types'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export type ResolveTxt = (hostname: string) => Promise<string[]>

export class DnsHandleResolver implements HandleResolver {
  constructor(protected resolveTxt: ResolveTxt) {}

  async resolve(handle: string): Promise<ResolvedHandle> {
    try {
      const results = await this.resolveTxt.call(null, `${SUBDOMAIN}.${handle}`)

      for (let i = 0; i < results.length; i++) {
        if (!results[i].startsWith(PREFIX)) continue

        // Ensure no other entry is present
        for (let j = i + 1; j < results.length; j++) {
          if (results[j].startsWith(PREFIX)) return null
        }

        const did = results[i].slice(PREFIX.length)
        return isResolvedHandle(did) ? did : null
      }

      return null
    } catch (err) {
      return null
    }
  }
}

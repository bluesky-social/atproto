import { HandleResolver, ResolvedHandle, isResolvedHandle } from '../types'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

/**
 * DNS TXT record resolver. Return `null` if the hostname successfully does not
 * resolve to a valid DID. Throw an error if an unexpected error occurs.
 */
export type ResolveTxt = (hostname: string) => Promise<null | string[]>

export class DnsHandleResolver implements HandleResolver {
  constructor(protected resolveTxt: ResolveTxt) {}

  async resolve(handle: string): Promise<ResolvedHandle> {
    const results = await this.resolveTxt.call(null, `${SUBDOMAIN}.${handle}`)

    if (!results) return null

    for (let i = 0; i < results.length; i++) {
      // If the line does not start with "did=", skip it
      if (!results[i].startsWith(PREFIX)) continue

      // Ensure no other entry starting with "did=" follows
      for (let j = i + 1; j < results.length; j++) {
        if (results[j].startsWith(PREFIX)) return null
      }

      // Note: No trimming (to be consistent with spec)
      const did = results[i].slice(PREFIX.length)

      // Invalid DBS record
      return isResolvedHandle(did) ? did : null
    }

    return null
  }
}

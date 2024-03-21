import { Resolver, lookup, resolveTxt } from 'node:dns/promises'

import {
  HandleResolveOptions,
  HandleResolver,
  ResolvedHandle,
  isResolvedHandle,
} from '@atproto/handle-resolver'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export const DEFAULT_EXCLUDE = [
  // bsky.social uses well-known resolution
  'bsky.social',
]

export type DnsHandleResolverOptions = {
  /**
   * Nameservers to use in place of the system's default nameservers.
   */
  nameservers?: string[]

  /**
   * Optimization: avoid flooding the DNS server with requests we know are going
   * to fail.
   *
   * @default See {@link DEFAULT_EXCLUDE}
   */
  exclude?: string[]
}

export class DnsHandleResolver implements HandleResolver {
  protected exclude: Set<string>
  protected resolveTxt: (hostname: string) => Promise<string[][]>

  constructor({
    exclude = DEFAULT_EXCLUDE,
    nameservers,
  }: DnsHandleResolverOptions = {}) {
    this.exclude = new Set(exclude)

    this.resolveTxt = nameservers ? buildResolveTxt(nameservers) : resolveTxt
  }

  protected isExcluded(handle: string): boolean {
    const domainName = extractDomainName(handle)
    return this.exclude.has(domainName)
  }

  public async resolve(
    handle: string,
    _options?: HandleResolveOptions,
  ): Promise<ResolvedHandle> {
    if (this.isExcluded(handle)) return null

    try {
      return parseDnsResult(await this.resolveTxt(`${SUBDOMAIN}.${handle}`))
    } catch (err) {
      return null
    }
  }
}

function extractDomainName(handle: string): string {
  const tldDot = handle.lastIndexOf('.')
  if (tldDot === -1) return handle // Normally not possible

  const domDot = handle.lastIndexOf('.', tldDot - 1)
  if (domDot === -1) return handle.slice(tldDot + 1)

  return handle.slice(domDot + 1)
}

function buildResolveTxt(
  nameservers: string[],
): (hostname: string) => Promise<string[][]> {
  const resolverPromise: Promise<Resolver | null> = Promise.allSettled(
    nameservers.map((h) => lookup(h)),
  )
    .then((responses) =>
      responses.flatMap((r) =>
        r.status === 'fulfilled' ? [r.value.address] : [],
      ),
    )
    .then((backupIps) => {
      if (!backupIps.length) return null
      const resolver = new Resolver()
      resolver.setServers(backupIps)
      return resolver
    })

  resolverPromise.catch(() => {
    // Should never happen
  })

  return async (hostname) => {
    const resolver = await resolverPromise
    return resolver ? resolver.resolveTxt(hostname) : []
  }
}

function parseDnsResult(chunkedResults: string[][]): ResolvedHandle {
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.filter((i) => i.startsWith(PREFIX))
  if (found.length !== 1) {
    return null
  }
  const did = found[0].slice(PREFIX.length)
  return isResolvedHandle(did) ? did : null
}

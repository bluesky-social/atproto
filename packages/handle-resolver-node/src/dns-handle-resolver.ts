import { Resolver, lookup, resolveTxt } from 'node:dns/promises'

import { isDid } from '@atproto/did'
import {
  HandleResolveOptions,
  HandleResolveValue,
  HandleResolver,
} from '@atproto/handle-resolver'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export const DEFAULT_EXCLUDE = [
  // bsky.social uses well-known resolution
  'bsky.social',
]

export type DnsHandleResolverOptions = {
  /**
   * Extra nameservers to use as a backup if resolution using the system's
   * default resolver fails.
   */
  backupNameservers?: string[]

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
  protected backupResolverPromise: Promise<null | Resolver>

  constructor({
    exclude = DEFAULT_EXCLUDE,
    backupNameservers,
  }: DnsHandleResolverOptions = {}) {
    this.exclude = new Set(exclude)
    this.backupResolverPromise = backupNameservers
      ? buildResolver(backupNameservers)
      : Promise.resolve(null)
  }

  protected isExcluded(handle: string): boolean {
    const domainName = extractDomainName(handle)
    return this.exclude.has(domainName)
  }

  public async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<HandleResolveValue> {
    if (this.isExcluded(handle)) throw new Error(`${handle} is excluded`)

    const subDomain = `${SUBDOMAIN}.${handle}`
    try {
      return parseDnsResult(await resolveTxt(subDomain))
    } catch (err) {
      if (!options?.signal?.aborted) {
        const backupResolver = await this.backupResolverPromise
        if (backupResolver) {
          return parseDnsResult(await backupResolver.resolveTxt(subDomain))
        }
      }
      throw err
    }
  }
}

function extractDomainName(handle: string): string {
  const tldDot = handle.lastIndexOf('.')
  if (tldDot === -1) return handle // Normally not possible

  const domDot = handle.lastIndexOf('.', tldDot - 1)
  if (domDot === -1) return handle

  return handle.slice(domDot + 1)
}

async function buildResolver(nameservers: string[]) {
  const responses = await Promise.allSettled(nameservers.map((h) => lookup(h)))
  const servers = responses.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value.address] : [],
  )
  if (!servers.length) return null
  const resolver = new Resolver()
  resolver.setServers(servers)
  return resolver
}

function parseDnsResult(chunkedResults: string[][]): HandleResolveValue {
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.filter((i) => i.startsWith(PREFIX))

  // The handle is positively not resolvable to a single DID
  if (found.length !== 1) return null

  const value = found[0].slice(PREFIX.length)
  // The handle is positively not resolvable to a supported DID method
  if (!isDid(value, ['web', 'plc'])) return null

  return value
}

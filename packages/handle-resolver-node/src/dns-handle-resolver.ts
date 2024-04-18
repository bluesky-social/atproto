import { Resolver, lookup, resolveTxt } from 'node:dns/promises'

import {
  HandleResolveOptions,
  HandleResolver,
  ResolvedHandle,
  isResolvedHandle,
} from '@atproto-labs/handle-resolver'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export type DnsHandleResolverOptions = {
  /**
   * Nameservers to use in place of the system's default nameservers.
   */
  nameservers?: string[]
}

export class DnsHandleResolver implements HandleResolver {
  protected resolveTxt: typeof resolveTxt

  constructor(options?: DnsHandleResolverOptions) {
    this.resolveTxt = options?.nameservers
      ? buildResolveTxt(options.nameservers)
      : resolveTxt.bind(null)
  }

  public async resolve(
    handle: string,
    _options?: HandleResolveOptions,
  ): Promise<ResolvedHandle> {
    try {
      return parseDnsResult(await this.resolveTxt(`${SUBDOMAIN}.${handle}`))
    } catch (err) {
      return null
    }
  }
}

function buildResolveTxt(nameservers: string[]): typeof resolveTxt {
  // Build the resolver asynchronously
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

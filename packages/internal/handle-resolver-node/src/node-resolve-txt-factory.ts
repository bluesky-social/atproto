import { Resolver, lookup, resolveTxt } from 'node:dns/promises'
import { isIP } from 'node:net'

import { ResolveTxt } from '@atproto-labs/handle-resolver'

export const nodeResolveTxtDefault: ResolveTxt = (hostname) =>
  resolveTxt(hostname).then(groupChunks)

export function nodeResolveTxtFactory(nameservers: string[]): ResolveTxt {
  // Optimization
  if (!nameservers.length) return async () => []

  // Build the resolver asynchronously (will be awaited on every use)
  const resolverPromise: Promise<Resolver | null> = Promise.all<string[]>(
    nameservers.map((nameserver) => {
      const [domain, port = null] = nameserver.split(':', 2)

      if (port !== null && !/^\d+$/.test(port)) {
        throw new TypeError(`Invalid name server "${nameserver}"`)
      }

      return isIP(domain) === 4 || isBracedIPv6(domain)
        ? [nameserver] // No need to lookup
        : lookup(domain, { all: true }).then(
            (r) => r.map((a) => appendPort(a.address, port)),
            // Let's just ignore failed nameservers resolution
            (_err) => [],
          )
    }),
  ).then((results) => {
    const backupIps = results.flat(1)
    // No resolver if no valid IP
    if (!backupIps.length) return null

    const resolver = new Resolver()
    resolver.setServers(backupIps)
    return resolver
  })

  // Avoid uncaught promise rejection
  void resolverPromise.catch(() => {
    // Should never happen though...
  })

  return async (hostname) => {
    const resolver = await resolverPromise
    return resolver ? resolver.resolveTxt(hostname).then(groupChunks) : []
  }
}

function isBracedIPv6(address: string): boolean {
  return (
    address.startsWith('[') &&
    address.endsWith(']') &&
    isIP(address.slice(1, -1)) === 6
  )
}

function groupChunks(results: string[][]): string[] {
  return results.map((chunks) => chunks.join(''))
}

function appendPort(address: string, port: string | null): string {
  switch (isIP(address)) {
    case 4:
      return port ? `${address}:${port}` : address
    case 6:
      return port ? `[${address}]:${port}` : `[${address}]`
    default:
      throw new TypeError(`Invalid IP address "${address}"`)
  }
}

import { Resolver, lookup, resolveTxt } from 'node:dns/promises'
import { isIP } from 'node:net'
import { ResolveTxt } from '@atproto-labs/handle-resolver'

export const nodeResolveTxtDefault: ResolveTxt = (hostname) =>
  resolveTxt(hostname).then(groupChunks, handleError)

export function nodeResolveTxtFactory(nameservers: string[]): ResolveTxt {
  // Optimization
  if (!nameservers.length) return async () => null

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
    return resolver
      ? resolver.resolveTxt(hostname).then(groupChunks, handleError)
      : null
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

function handleError(err: unknown) {
  // Invalid argument type (e.g. hostname is a number)
  if (err instanceof TypeError) throw err

  // If the hostname does not resolve, return null
  if (err instanceof Error) {
    if (err['code'] === 'ENOTFOUND') return null

    // Hostname is not a valid domain name
    if (err['code'] === 'EBADNAME') throw err

    // DNS server unreachable
    // if (err['code'] === 'ETIMEOUT') throw err
  }

  // Historically, errors were not thrown here. A "null" value indicates to the
  // AtprotoHandleResolver that it should try the fallback resolver.

  // @TODO We might want to re-visit this to only apply when an unexpected error
  // occurs (by throwing here). For now, let's keep the same behavior as before.

  // throw err

  return null
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

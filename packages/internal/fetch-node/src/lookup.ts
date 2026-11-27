// @NOTE The promises API is reached through `node:dns` rather than imported
// from `node:dns/promises`, which tests commonly replace with a partial mock
// (to stub `resolveTxt`), while this runs as soon as a fetch is wrapped.
import { type LookupAddress, type ResolverOptions, promises } from 'node:dns'
import type { Resolver } from 'node:dns/promises'
import { type LookupFunction, isIP } from 'node:net'

/**
 * A `net.connect` lookup that queries DNS through a {@link Resolver}
 * (`resolve4` and `resolve6`, i.e. c-ares) rather than `dns.lookup`.
 *
 * `dns.lookup` calls `getaddrinfo` on libuv's threadpool, which it shares with
 * `fs`, `crypto` and `zlib`, and cannot be cancelled: a few hosts whose
 * nameservers don't answer hold every thread until the system resolver gives
 * up, stalling all other work in the process. A {@link Resolver} uses no
 * thread, and gives up after its `timeout` (per query, 2s by default here) and
 * `tries` (2 per nameserver by default here).
 *
 * Unlike `dns.lookup`, it doesn't read `/etc/hosts` nor apply the system's
 * search domains, so it suits public hostnames only. IPv4 addresses come
 * first. As with `dns.lookup`, a name without addresses fails with
 * `ENOTFOUND`, while other failures keep the resolver's code (e.g.
 * `ETIMEOUT`, where `dns.lookup` would report `EAI_AGAIN`).
 *
 * @see {@link https://nodejs.org/api/dns.html#implementation-considerations}
 */
export function createResolverLookup(
  options?: ResolverOptions | Resolver,
): LookupFunction {
  const resolver =
    options instanceof promises.Resolver
      ? options
      : new promises.Resolver({
          ...options,
          timeout: options?.timeout ?? 2_000,
          tries: options?.tries ?? 2,
        })

  return (hostname, { family = 0, all = false }, callback) => {
    const only = family === 'IPv4' ? 4 : family === 'IPv6' ? 6 : family
    // @NOTE The callback runs on its own tick (as with `util.callbackify`): an
    // exception it throws must be uncaught, as with `dns.lookup`, rather than
    // reject a promise nothing handles.
    resolveAddresses(resolver, hostname, only).then(
      (addresses) =>
        process.nextTick(() => {
          if (all) callback(null, addresses)
          else callback(null, addresses[0].address, addresses[0].family)
        }),
      (err: NodeJS.ErrnoException) =>
        process.nextTick(callback, err, all ? [] : ''),
    )
  }
}

async function resolveAddresses(
  resolver: Resolver,
  hostname: string,
  family: number,
): Promise<LookupAddress[]> {
  // @NOTE `net.connect` never looks up an IP literal, but other callers may:
  // like `dns.lookup`, resolve it to itself.
  const version = isIP(hostname)
  if (version !== 0) {
    if (family === 0 || family === version) {
      return [{ address: hostname, family: version }]
    }
    throw notFoundError(hostname)
  }

  const [v4, v6] = await Promise.allSettled([
    family === 6 ? [] : resolver.resolve4(hostname),
    family === 4 ? [] : resolver.resolve6(hostname),
  ])
  const addresses: LookupAddress[] = [
    ...(v4.status === 'fulfilled' ? v4.value : []).map((address) => ({
      address,
      family: 4,
    })),
    ...(v6.status === 'fulfilled' ? v6.value : []).map((address) => ({
      address,
      family: 6,
    })),
  ]
  if (addresses.length > 0) return addresses

  // @NOTE A query that failed (e.g. ETIMEOUT) is reported as is. Otherwise, the
  // name has no addresses (ENOTFOUND, ENODATA, or e.g. a CNAME to a name
  // without records), which `dns.lookup` reports as ENOTFOUND: error
  // classifiers, such as `@atproto-labs/fetch`'s, only know that code.
  for (const result of [v4, v6]) {
    if (
      result.status === 'rejected' &&
      !NO_ADDRESS_CODES.has(result.reason?.code)
    ) {
      throw result.reason
    }
  }
  throw notFoundError(hostname)
}

const NO_ADDRESS_CODES = new Set(['ENOTFOUND', 'ENODATA'])

function notFoundError(hostname: string) {
  return Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
    code: 'ENOTFOUND',
    hostname,
  })
}

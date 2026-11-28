// @NOTE The promises API is reached through `node:dns` rather than imported
// from `node:dns/promises`, which tests commonly replace with a partial mock
// (to stub `resolveTxt`), while this runs as soon as a fetch is wrapped.
import {
  type LookupAddress,
  type ResolverOptions,
  lookup as dnsLookup,
  promises,
} from 'node:dns'
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

export type LimitedLookupOptions = {
  /**
   * How many lookups may run at once.
   *
   * @default 1
   */
  concurrency?: number

  /**
   * How long (in ms) a lookup may wait for its turn and run before it fails
   * with `ETIMEOUT`. A lookup that timed out while running keeps its slot until
   * it completes, as a `dns.lookup` call cannot be cancelled.
   *
   * @default 5000
   */
  timeout?: number
}

/**
 * Bounds how many calls to {@link lookup} (`dns.lookup` by default) run at
 * once, queueing the others.
 *
 * Each `dns.lookup` call holds one of libuv's threadpool threads (4 by default,
 * shared with `fs`, `crypto` and `zlib`) until the system resolver answers or
 * gives up. Bounding them leaves the rest of the threadpool to the rest of the
 * process. Lookups still wait on each other though: a host whose nameservers
 * don't answer holds its slot until the system resolver gives up, and the
 * lookups queued behind it time out meanwhile. {@link createResolverLookup}
 * has no such limit, and should be preferred for hosts users name unless they
 * must be resolved as the rest of the system does (e.g. through `/etc/hosts`).
 *
 * @note The limit only holds among the lookups going through the returned
 * function: share it rather than creating one per agent.
 */
export function createLimitedLookup(
  // @NOTE Resolved on every call rather than captured, so that instrumentation
  // patching `dns.lookup` after this module is loaded still applies.
  lookup: LookupFunction = (hostname, options, callback) =>
    dnsLookup(hostname, options, callback),
  { concurrency = 1, timeout = 5_000 }: LimitedLookupOptions = {},
): LookupFunction {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`Invalid lookup concurrency: ${concurrency}`)
  }
  // @NOTE Node.js runs a timer above 2^31-1 ms after 1 ms
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2 ** 31 - 1) {
    throw new RangeError(`Invalid lookup timeout: ${timeout}`)
  }

  let running = 0
  const queue = new Set<() => void>()

  // @NOTE Lookups that complete synchronously free their slot while the queue
  // is being drained: the loop below picks it up, rather than a call to
  // `next()` per lookup, nested as deep as the queue is long.
  let draining = false
  const next = () => {
    if (draining) return
    draining = true
    try {
      for (const start of queue) {
        if (running >= concurrency) return
        queue.delete(start)
        start()
      }
    } finally {
      draining = false
    }
  }

  return (hostname, options, callback) => {
    let settled = false
    const settle: typeof callback = (err, address, family) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback(err, address, family)
    }

    const timer = setTimeout(() => {
      // Still queued, or running (in which case it keeps its slot)
      queue.delete(start)
      settle(timeoutError(hostname), options.all ? [] : '')
    }, timeout)

    const start = () => {
      running++
      let released = false
      const release = () => {
        if (released) return
        released = true
        running--
        next()
      }

      let sync = true
      try {
        lookup(hostname, options, (err, address, family) => {
          // @NOTE Released before calling back, so that an exception thrown by
          // the callback cannot hold the slot. A callback is never called on
          // the tick of the lookup that started it (as with `dns.lookup`), so
          // that what it throws escapes rather than reaching the catch below.
          release()
          if (sync) process.nextTick(settle, err, address, family)
          else settle(err, address, family)
        })
      } catch (err) {
        if (released) {
          // Thrown by the lookup after it called back: don't swallow it
          process.nextTick(() => {
            throw err
          })
        } else {
          release()
          process.nextTick(settle, err, options.all ? [] : '')
        }
      } finally {
        sync = false
      }
    }

    queue.add(start)
    next()
  }
}

function timeoutError(hostname: string) {
  return Object.assign(new Error(`Lookup of ${hostname} timed out`), {
    code: 'ETIMEOUT',
    hostname,
  })
}

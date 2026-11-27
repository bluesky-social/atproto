import { lookup as dnsLookup } from 'node:dns'
import { type LookupFunction, isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import {
  type Fetch,
  type FetchContext,
  FetchRequestError,
  type UrlPolicyReason,
  asRequest,
  extractUrl,
} from '@atproto-labs/fetch'
import { createDispatcherFetch } from './dispatch.js'
import { createResolverLookup } from './lookup.js'
import { isUnicastIpHostname } from './util.js'

const { IPv4, IPv6 } = ipaddr

export type UnicastFetchOptions<C = FetchContext> = {
  fetch?: Fetch<C>

  /**
   * Resolves hostnames at connect time. The unicast check is applied to
   * whatever it returns, so a custom lookup cannot bypass it.
   *
   * Pass `dns.lookup` to resolve them as the rest of the process does (e.g.
   * through `/etc/hosts`), at the cost described in
   * {@link createResolverLookup}.
   *
   * @note Must honor `options.all`: `net.connect` requests every address when
   * `autoSelectFamily` is enabled, which is the default.
   *
   * @default createResolverLookup()
   */
  lookup?: LookupFunction
}

/**
 * Rejects urls whose host is a literal non-unicast IP address.
 *
 * @note This is *not* redundant with {@link unicastLookup}: NodeJS does not
 * perform DNS resolution for literal-IP hosts, so the connect-time lookup is
 * never invoked for them. Without this check, a request to (or a redirect
 * towards) `http://127.0.0.1/` would not be checked at all.
 */
export function checkUnicastPolicy(url: URL): UrlPolicyReason | undefined {
  if (url.hostname && isUnicastIpHostname(url.hostname) === false) {
    return 'Hostname is a non-unicast address'
  }
  return undefined
}

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export function createUnicastFetch<C = FetchContext>({
  fetch = globalThis.fetch,
  lookup = createResolverLookup(),
}: UnicastFetchOptions<C> = {}): Fetch<C> & AsyncDisposable {
  const dispatchFetch = createDispatcherFetch<C>({
    fetch,
    checkUrl: checkUnicastPolicy,
    lookup: createUnicastLookup(lookup),
  })

  const wrappedFetch: Fetch<C> = async function (
    input,
    init,
  ): Promise<Response> {
    // @NOTE The dispatcher guard already applies this check to every request,
    // including redirect hops. It is repeated here so that a rejection of the
    // *initial* url happens before any body is consumed, and so that the error
    // carries the caller's own Request.
    const reason = checkUnicastPolicy(extractUrl(input))
    if (reason) {
      const request = asRequest(input, init)
      await request.body?.cancel()
      const cause = new FetchRequestError(request, 400, reason)
      // @NOTE Use Whatwg style errors so that the error is similar whether
      // caused by this line of an error caused by the lookup function
      throw new TypeError('fetch failed', { cause })
    }

    return dispatchFetch.call(this, input, init)
  }

  Object.defineProperty(wrappedFetch, Symbol.asyncDispose, {
    value: async () => dispatchFetch[Symbol.asyncDispose](),
    enumerable: false,
    configurable: true,
  })

  return wrappedFetch as Fetch<C> & AsyncDisposable
}

/**
 * {@link createUnicastLookup} over the system's `dns.lookup`, which hosts users
 * name are better not resolved with: see {@link createResolverLookup}.
 */
export const unicastLookup: LookupFunction = createUnicastLookup(
  // @NOTE Resolved on every call rather than captured, so that instrumentation
  // patching `dns.lookup` after this module is loaded still applies.
  (hostname, options, callback) => dnsLookup(hostname, options, callback),
)

/**
 * Applies the unicast check to the addresses returned by {@link lookup}
 * ({@link createResolverLookup} by default).
 *
 * @note A custom lookup's result is not trusted to be well formed: an address
 * that is not a valid IP is rejected (rather than thrown on, which would
 * escape as an uncaught exception from an asynchronous callback), and the
 * family is derived from the address rather than taken from the lookup.
 */
export function createUnicastLookup(
  lookup: LookupFunction = createResolverLookup(),
): LookupFunction {
  return (hostname, options, callback) => {
    if (isLocalHostname(hostname)) {
      callback(new Error('Hostname is not a public domain'), [])
      return
    }

    lookup(hostname, options, (err, address, family) => {
      if (err) {
        callback(err, address, family)
        return
      }

      const ips = Array.isArray(address)
        ? address.map((entry) => parseLookupAddress(entry?.address))
        : [parseLookupAddress(address)]

      if (ips.length === 0) {
        // @NOTE `net.connect` throws an uncaught exception when an `all`
        // lookup succeeds without any address.
        callback(
          new Error('Hostname did not resolve to any address'),
          address,
          family,
        )
      } else if (ips.includes(null)) {
        callback(
          new Error('Hostname resolved to an invalid address'),
          address,
          family,
        )
      } else if (ips.some(isNotUnicast)) {
        callback(
          new Error('Hostname resolved to non-unicast address'),
          address,
          family,
        )
      } else {
        callback(null, address, family)
      }
    })
  }
}

/**
 * @param hostname - a syntactically valid hostname
 * @returns whether the hostname is a name typically used for on locale area networks.
 * @note **DO NOT** use for security reasons. Only as heuristic.
 */
function isLocalHostname(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length < 2) return true

  const tld = parts.at(-1)!.toLowerCase()
  return (
    tld === 'test' ||
    tld === 'local' ||
    tld === 'localhost' ||
    tld === 'invalid' ||
    tld === 'example'
  )
}

function isNotUnicast(ip: ipaddr.IPv4 | ipaddr.IPv6 | null): boolean {
  return ip?.range() !== 'unicast'
}

function parseLookupAddress(
  address: unknown,
): ipaddr.IPv4 | ipaddr.IPv6 | null {
  // @NOTE The address comes from a caller-provided lookup, so its type is not
  // guaranteed. `isIP` coerces its argument to a string (accepting e.g. an
  // `ipaddr.js` object) while `ipaddr.parse` throws on anything but a string,
  // which would escape the lookup callback as an uncaught exception.
  if (typeof address !== 'string') return null

  // @NOTE `isIP` is the check `net.connect` applies to the address it dials,
  // and is stricter than `ipaddr.parse`, which reads `010.0.0.1` as `8.0.0.1`.
  const version = isIP(address)
  if (version === 0) return null

  const ip = version === 4 ? IPv4.parse(address) : IPv6.parse(address)

  if (ip instanceof IPv6 && ip.isIPv4MappedAddress()) {
    return ip.toIPv4Address()
  } else {
    return ip
  }
}

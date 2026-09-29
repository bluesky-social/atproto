import type { LookupAddress, LookupOptions } from 'node:dns'
import { lookup } from 'node:dns'
import type { LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import {
  type Fetch,
  type FetchContext,
  FetchRequestError,
  type UrlPolicyReason,
  asRequest,
  extractUrl,
} from '@atproto-labs/fetch'
import { safeDispatchFetchWrap } from './dispatch.js'
import { isUnicastIpHostname } from './util.js'

const { IPv4, IPv6 } = ipaddr

export type UnicastFetchWrapOptions<C = FetchContext> = {
  fetch?: Fetch<C>
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
export function unicastFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
}: UnicastFetchWrapOptions<C> = {}): Fetch<C> {
  const dispatchFetch = safeDispatchFetchWrap<C>({
    fetch,
    checkUrl: checkUnicastPolicy,
    lookup: unicastLookup,
  })

  return async function (this: C, input, init): Promise<Response> {
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
}

export function unicastLookup(
  hostname: string,
  options: LookupOptions,
  callback: Parameters<LookupFunction>[2],
) {
  if (isLocalHostname(hostname)) {
    callback(new Error('Hostname is not a public domain'), [])
    return
  }

  lookup(hostname, options, (err, address, family) => {
    if (err) {
      callback(err, address, family)
    } else {
      const ips = Array.isArray(address)
        ? address.map(parseLookupAddress)
        : [parseLookupAddress({ address, family })]

      if (ips.some(isNotUnicast)) {
        callback(
          new Error('Hostname resolved to non-unicast address'),
          address,
          family,
        )
      } else {
        callback(null, address, family)
      }
    }
  })
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

function isNotUnicast(ip: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  return ip.range() !== 'unicast'
}

function parseLookupAddress({
  address,
  family,
}: LookupAddress): ipaddr.IPv4 | ipaddr.IPv6 {
  const ip = family === 4 ? IPv4.parse(address) : IPv6.parse(address)

  if (ip instanceof IPv6 && ip.isIPv4MappedAddress()) {
    return ip.toIPv4Address()
  } else {
    return ip
  }
}

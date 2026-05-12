import dns, { LookupAddress } from 'node:dns'
import { LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { Agent } from 'undici'
import {
  Fetch,
  FetchContext,
  FetchRequestError,
  asRequest,
  extractUrl,
} from '@atproto-labs/fetch'
import { isUnicastIp } from './util.js'

const { IPv4, IPv6 } = ipaddr

export type UnicastFetchWrapOptions<C = FetchContext> = {
  fetch?: Fetch<C>
}

const SUPPORTS_REQUEST_INIT_DISPATCHER =
  Number(process.versions.node.split('.')[0]) >= 20

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export function unicastFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
}: UnicastFetchWrapOptions<C>): Fetch<C> {
  if (!SUPPORTS_REQUEST_INIT_DISPATCHER) {
    throw new Error(
      'Unicast SSRF protection unavailable on your platform. Update to Node.js 22+.',
    )
  }

  const dispatcher = new Agent({
    connect: { lookup: unicastLookup },
  })

  return async function (input, init): Promise<Response> {
    if (init?.dispatcher) {
      throw new FetchRequestError(
        asRequest(input, init),
        500,
        'SSRF protection cannot be used with a custom request dispatcher',
      )
    }

    const url = extractUrl(input)

    if (url.hostname && isUnicastIp(url.hostname) === false) {
      throw new FetchRequestError(
        asRequest(input, init),
        400,
        'Hostname is a non-unicast address',
      )
    }

    // @ts-expect-error non-standard option
    const request = new Request(input, { ...init, dispatcher })
    return fetch.call(this, request)
  }
}

export function unicastLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: Parameters<LookupFunction>[2],
) {
  if (isLocalHostname(hostname)) {
    callback(new Error('Hostname is not a public domain'), [])
    return
  }

  dns.lookup(hostname, options, (err, address, family) => {
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

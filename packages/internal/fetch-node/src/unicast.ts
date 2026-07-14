import type { LookupAddress, LookupOptions } from 'node:dns'
import { lookup } from 'node:dns'
import type { LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { Agent as Undici6Agent } from 'undici_v6' // NodeJS 22
import { Agent as Undici7Agent } from 'undici_v7' // NodeJS 24
import { Agent as Undici8Agent } from 'undici_v8' // NodeJS 26
import {
  type Fetch,
  type FetchContext,
  FetchRequestError,
  asRequest,
  extractUrl,
} from '@atproto-labs/fetch'
import { compareVersions, isUnicastIpHostname, parseVersion } from './util.js'

const { IPv4, IPv6 } = ipaddr

export type UnicastFetchWrapOptions<C = FetchContext> = {
  fetch?: Fetch<C>
}

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export function unicastFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
}: UnicastFetchWrapOptions<C> = {}): Fetch<C> {
  // @NOTE we parse here instead of top-level to allow version mocking in tests.
  const nodeUndiciVersion = parseVersion(process.versions.undici)

  if (
    !nodeUndiciVersion ||
    // https://github.com/nodejs/undici/pull/2928
    compareVersions(nodeUndiciVersion, [6, 11, 1]) < 0
  ) {
    throw new Error('Unicast SSRF protection requires Node.js 20.6+')
  }

  // @NOTE Since major versions of undici are not guaranteed to be backwards
  // compatible, we need to check the major version and use the appropriate
  // Agent class for that version, to ensure that the dispatcher interface is
  // compatible with the version of undici being used.
  const dispatcher =
    nodeUndiciVersion[0] === 6
      ? new Undici6Agent({ connect: { lookup: unicastLookup } })
      : nodeUndiciVersion[0] === 7
        ? new Undici7Agent({ connect: { lookup: unicastLookup } })
        : nodeUndiciVersion[0] === 8
          ? new Undici8Agent({ connect: { lookup: unicastLookup } })
          : null

  // @NOTE Because this is a security feature, we don't want to fallback to
  // using Agent8 to "future proof" this package. Although future version of
  // undici may have a backwards compatible dispatcher interface, we don't want
  // to assume that and risk a security issue.
  if (!dispatcher) {
    throw new Error(
      'This version of @atproto-labs/fetch-node does not support your version of undici. Please upgrade @atproto-labs/fetch-node, and use a version of NodeJS that uses undici 6, 7, or 8 internally.',
    )
  }

  return async function (this: C, input, init): Promise<Response> {
    if (init != null && 'dispatcher' in init && init.dispatcher != null) {
      const request = asRequest(input, init)
      await request.body?.cancel()
      const cause = new FetchRequestError(
        request,
        500,
        'SSRF protection cannot be used with a custom request dispatcher',
      )
      // @NOTE Use Whatwg style errors so that the error is similar whether
      // caused by this line of an error caused by the lookup function
      throw new TypeError('fetch failed', { cause })
    }

    const url = extractUrl(input)

    if (url.hostname && isUnicastIpHostname(url.hostname) === false) {
      const request = asRequest(input, init)
      await request.body?.cancel()
      const cause = new FetchRequestError(
        request,
        400,
        'Hostname is a non-unicast address',
      )
      // @NOTE Use Whatwg style errors so that the error is similar whether
      // caused by this line of an error caused by the lookup function
      throw new TypeError('fetch failed', { cause })
    }

    return fetch.call(this, input, {
      ...init,
      // @ts-ignore There is a type mismatch because of undici version
      // differences, but we know this is safe because we are using the correct
      // Agent class for the undici version.
      dispatcher,
    })
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

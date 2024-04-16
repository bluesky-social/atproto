import dns, { promises as dnsPromises } from 'node:dns'

import { Fetch, FetchError } from '@atproto/fetch'
import ipaddr from 'ipaddr.js'

const { IPv4, IPv6 } = ipaddr

export type SsrfSafeFetchWrapOptions = NonNullable<
  Parameters<typeof ssrfFetchWrap>[0]
>
export const ssrfFetchWrap = ({
  fetch = globalThis.fetch as Fetch,
} = {}): Fetch => {
  const ssrfSafeFetch: Fetch = async (request) => {
    const { protocol, hostname } = new URL(request.url)

    if (protocol === 'http:' || protocol === 'https:') {
      if (request.redirect === 'follow') {
        // TODO: actually implement by calling ssrfSafeFetch recursively (?)
        throw new FetchError(
          500,
          'Request redirect must be "error" or "manual" when SSRF is enabled',
          { request },
        )
      }

      // Make sure the hostname is a unicast IP address
      const ip = await hostnameLookup(hostname).catch((cause) => {
        throw cause?.code === 'ENOTFOUND'
          ? new FetchError(400, `Invalid hostname ${hostname}`, {
              request,
              cause,
            })
          : new FetchError(500, `Unable resolve DNS for ${hostname}`, {
              request,
              cause,
            })
      })
      if (ip.range() !== 'unicast') {
        throw new FetchError(400, `Invalid hostname IP address ${ip}`, {
          request,
        })
      }
    } else if (protocol === 'data:') {
      // No SSRF issue
    } else {
      // blob: about: file: all should be rejected
      throw new FetchError(400, `Forbidden protocol ${protocol}`, { request })
    }

    return fetch(request)
  }

  return ssrfSafeFetch
}

async function hostnameLookup(
  hostname: string,
): Promise<ipaddr.IPv4 | ipaddr.IPv6> {
  if (IPv4.isIPv4(hostname)) {
    return IPv4.parse(hostname)
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return IPv6.parse(hostname.slice(1, -1))
  }

  return domainLookup(hostname)
}

async function domainLookup(
  domain: string,
): Promise<ipaddr.IPv4 | ipaddr.IPv6> {
  const addr = await dnsPromises.lookup(domain, {
    hints: dns.ADDRCONFIG | dns.V4MAPPED,
  })

  const ip =
    addr.family === 4 ? IPv4.parse(addr.address) : IPv6.parse(addr.address)

  if (ip instanceof IPv6 && ip.isIPv4MappedAddress()) {
    return ip.toIPv4Address()
  }

  return ip
}

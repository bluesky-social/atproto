import dns, { LookupAddress } from 'node:dns'
import { LookupFunction } from 'node:net'

import { FetchError, toGlobalFetch } from '@atproto-labs/fetch'
import ipaddr from 'ipaddr.js'
import { Agent } from 'undici'

const { IPv4, IPv6 } = ipaddr

const [NODE_VERSION] = process.versions.node.split('.').map(Number)

export type SsrfSafeFetchWrapOptions = NonNullable<
  Parameters<typeof ssrfFetchWrap>[0]
>
export const ssrfAgent = new Agent({ connect: { lookup } })

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export const ssrfFetchWrap = ({
  allowCustomPort = false,
  fetch = globalThis.fetch,
} = {}) => {
  return toGlobalFetch(async (request) => {
    const { protocol, hostname, port } = new URL(request.url)

    if (protocol === 'data:') {
      // No SSRF issue
      return fetch(request)
    }

    if (protocol === 'http:' || protocol === 'https:') {
      // @ts-expect-error non-standard option
      if (request.dispatcher) {
        throw new FetchError(
          500,
          'SSRF protection cannot be used with a custom request dispatcher',
          { request },
        )
      }

      // Check port (OWASP)
      if (!allowCustomPort && port !== '') {
        throw new FetchError(
          400,
          'Request port must be omitted or standard when SSRF is enabled',
          { request },
        )
      }

      // Disable HTTP redirections (OWASP)
      if (request.redirect === 'follow') {
        throw new FetchError(
          500,
          'Request redirect must be "error" or "manual" when SSRF is enabled',
          { request },
        )
      }

      // If the hostname is an IP address, it must be a unicast address.
      const ip = parseIpHostname(hostname)
      if (ip) {
        if (ip.range() !== 'unicast') {
          throw new FetchError(400, 'Hostname resolved to non-unicast address')
        }
        // No additional check required
        return fetch(request)
      }

      // Else hostname is a domain name, use DNS lookup to check if it resolves
      // to a unicast address

      if (NODE_VERSION < 21) {
        // Note: due to the issue nodejs/undici#2828 (fixed in undici >=6.7.0,
        // Node >=21), the "dispatcher" property of the request object will not
        // be used by fetch(). As a workaround, we pass the dispatcher as second
        // argument to fetch() here, and make sure it is used (which might not be
        // the case if a custom fetch() function is used).

        if (fetch === globalThis.fetch) {
          // If the global fetch function is used, we can pass the dispatcher
          // singleton directly to the fetch function as we know it will be
          // used.

          // @ts-expect-error non-standard option
          return fetch(request, { dispatcher: ssrfAgent })
        }

        let didLookup = false
        const dispatcher = new Agent({
          connect: {
            lookup(...args) {
              didLookup = true
              lookup(...args)
            },
          },
        })

        try {
          // @ts-expect-error non-standard option
          return await fetch(request, { dispatcher })
        } finally {
          // Free resources (we cannot await here since the response was not
          // consumed yet).
          void dispatcher.close().catch((err) => {
            // No biggie, but let's still log it
            console.warn('Failed to close dispatcher', err)
          })

          if (!didLookup) {
            // If you encounter this error, either upgrade to Node.js >=21 or
            // make sure that the requestInit object is passed as second
            // argument to the global fetch function.

            // eslint-disable-next-line no-unsafe-finally
            throw new FetchError(500, 'Unable to enforce SSRF protection', {
              request,
            })
          }
        }
      }

      // @ts-expect-error non-standard option
      return fetch(new Request(request, { dispatcher: ssrfAgent }))
    }

    // blob: about: file: all should be rejected
    throw new FetchError(400, `Forbidden protocol "${protocol}"`, { request })
  })
}

function parseIpHostname(
  hostname: string,
): ipaddr.IPv4 | ipaddr.IPv6 | undefined {
  if (IPv4.isIPv4(hostname)) {
    return IPv4.parse(hostname)
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return IPv6.parse(hostname.slice(1, -1))
  }

  return undefined
}

function lookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: Parameters<LookupFunction>[2],
) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      callback(err, address, family)
    } else {
      const ips = Array.isArray(address)
        ? address.map(parseLookupAddress)
        : [parseLookupAddress({ address, family })]

      if (ips.some((ip) => ip.range() !== 'unicast')) {
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

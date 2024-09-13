import dns, { LookupAddress } from 'node:dns'
import { LookupFunction } from 'node:net'

import {
  Fetch,
  FetchContext,
  FetchRequestError,
  toRequestTransformer,
} from '@atproto-labs/fetch'
import ipaddr from 'ipaddr.js'
import { isValid as isValidDomain } from 'psl'
import { Agent, Client } from 'undici'

import { isUnicastIp } from './util.js'

const { IPv4, IPv6 } = ipaddr

const [NODE_VERSION] = process.versions.node.split('.').map(Number)

export type SsrfFetchWrapOptions<C = FetchContext> = {
  allowCustomPort?: boolean
  fetch?: Fetch<C>
}

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export function unicastFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
}: SsrfFetchWrapOptions<C>): Fetch<C> {
  const ssrfAgent = new Agent({ connect: { lookup: unicastLookup } })

  return toRequestTransformer(async function (
    this: C,
    request,
  ): Promise<Response> {
    const url = new URL(request.url)

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      switch (isUnicastIp(url.hostname)) {
        case true:
          // Safe to proceed
          return fetch.call(this, request)

        case false:
          throw new FetchRequestError(
            request,
            400,
            'Hostname is a non-unicast address',
          )

        case undefined:
          // hostname is a domain name, use DNS lookup to check if it resolves
          // to a unicast address (see bellow)
          break
      }

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
          return fetch.call(this, request, { dispatcher: ssrfAgent })
        }

        let didLookup = false
        const dispatcher = new Client(url, {
          connect: {
            lookup(...args) {
              didLookup = true
              unicastLookup(...args)
            },
          },
        })

        try {
          // @ts-expect-error non-standard option
          return await fetch.call(this, request, { dispatcher })
        } finally {
          // Free resources (we cannot await here since the response was not
          // consumed yet).
          void dispatcher.close().catch((err) => {
            // No biggie, but let's still log it
            console.warn('Failed to close dispatcher', err)
          })

          if (!didLookup) {
            // If you encounter this error, either upgrade to Node.js >=21 or
            // make sure that the dispatcher passed through the requestInit
            // object ends up being used to make the request.

            // eslint-disable-next-line no-unsafe-finally
            throw new FetchRequestError(
              request,
              500,
              'Unable to enforce SSRF protection',
            )
          }
        }
      }

      // @ts-expect-error non-standard option
      return fetch.call(this, new Request(request, { dispatcher: ssrfAgent }))
    }

    return fetch.call(this, request)
  })
}

export function unicastLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: Parameters<LookupFunction>[2],
) {
  if (!isValidDomain(hostname)) {
    callback(new Error('Hostname is not a public domain'), '')
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

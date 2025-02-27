import dns, { LookupAddress } from 'node:dns'
import { LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { parse as pslParse } from 'psl'
import { Agent, Client } from 'undici'
import {
  Fetch,
  FetchContext,
  FetchRequestError,
  asRequest,
  extractUrl,
} from '@atproto-labs/fetch'
import { isUnicastIp } from './util.js'

const { IPv4, IPv6 } = ipaddr

export type SsrfFetchWrapOptions<C = FetchContext> = {
  fetch?: Fetch<C>
}

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export function unicastFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
}: SsrfFetchWrapOptions<C>): Fetch<C> {
  // In order to enforce the SSRF protection, we need to use a custom dispatcher
  // that uses "unicastLookup" to resolve the hostname to a unicast IP address.

  // In case a custom "fetch" function is passed here, we have no assurance that
  // the dispatcher will be used to make the request. Because of this, in case a
  // custom fetch method is passed, we will use a on-time use dispatcher that
  // ensures that "unicastLookup" gets called to resolve the hostname to an IP
  // address and ensure that it is a unicast address.

  // Sadly, this means that we cannot use "keepAlive" connections, as the method
  // used to ensure that "unicastLookup" gets called requires to create a new
  // dispatcher for each request.

  // @TODO: find a way to use a re-usable dispatcher with a custom fetch method.

  if (fetch === globalThis.fetch) {
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
      return fetch.call(this, input, { ...init, dispatcher })
    }
  } else {
    return async function (input, init): Promise<Response> {
      if (init?.dispatcher) {
        throw new FetchRequestError(
          asRequest(input, init),
          500,
          'SSRF protection cannot be used with a custom request dispatcher',
        )
      }

      const url = extractUrl(input)

      if (!url.hostname) {
        return fetch.call(this, input, init)
      }

      switch (isUnicastIp(url.hostname)) {
        case true: {
          // hostname is a unicast address, safe to proceed.
          return fetch.call(this, input, init)
        }

        case false: {
          throw new FetchRequestError(
            asRequest(input, init),
            400,
            'Hostname is a non-unicast address',
          )
        }

        case undefined: {
          // hostname is a domain name, using the dispatcher defined above
          // will result in the DNS lookup being performed, ensuring that the
          // hostname resolves to a unicast address.

          let didLookup = false
          const dispatcher = new Client(url.origin, {
            // Do *not* enable H2 here, as it will cause an error (the client
            // will terminate the connection before the response is consumed).
            // https://github.com/nodejs/undici/issues/3671
            connect: {
              keepAlive: false, // Client will be used once
              lookup(...args) {
                didLookup = true
                unicastLookup(...args)
              },
            },
          })

          const headers = new Headers(init?.headers)
          headers.set('connection', 'close') // Proactively close the connection

          try {
            return await fetch.call(this, input, {
              ...init,
              headers,
              // @ts-expect-error non-standard option
              dispatcher,
            })
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
                asRequest(input, init),
                500,
                'Unable to enforce SSRF protection',
              )
            }
          }
        }
      }
    }
  }
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

// see lupomontero/psl#258 for context on psl usage.
// in short, this ensures a structurally valid domain
// plus a "listed" tld.
function isValidDomain(domain: string) {
  const parsed = pslParse(domain)
  return !parsed.error && parsed.listed
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

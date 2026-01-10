import dns, { LookupAddress } from 'node:dns'
import { LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
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

export type UnicastFetchWrapOptions<C = FetchContext> = {
  fetch?: Fetch<C>

  /**
   * ## ‼️ important security feature use with care
   *
   * On older NodeJS version, the `dispatcher` init option is ignored when
   * creating a new Request instance. It can only be passed through the fetch
   * function directly.
   *
   * Since this is a security feature, we need to ensure that the unicastLookup
   * function is called to resolve the hostname to a unicast IP address.
   *
   * However, in the case a custom "fetch" function is passed here (fetch !==
   * globalThis.fetch), we have no guarantee that the dispatcher will be used to
   * make the request. Because of this, in such a case, we will use a one-time
   * use dispatcher that checks that the provided fetch function indeed made use
   * of the "unicastLookup" when a custom dispatch init function is used.
   *
   * Sadly, this means that we cannot use "keepAlive" connections, as the method
   * used to ensure that "unicastLookup" gets called requires to create a new
   * dispatcher for each request.
   *
   * If you can guarantee that the provided fetch function will make use of the
   * "dispatcher" init option, you can set this flag to true, which will enable
   * the use of a single agent (with keep-alive) for all requests.
   *
   * @default false
   * @note This option has no effect on Node.js versions >= 20
   */
  dangerouslyForceKeepAliveAgent?: boolean
}

// @TODO support other runtimes ?
const SUPPORTS_REQUEST_INIT_DISPATCHER =
  Number(process.versions.node.split('.')[0]) >= 20

/**
 * @see {@link https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/}
 */
export function unicastFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
  dangerouslyForceKeepAliveAgent = false,
}: UnicastFetchWrapOptions<C>): Fetch<C> {
  if (
    SUPPORTS_REQUEST_INIT_DISPATCHER ||
    dangerouslyForceKeepAliveAgent ||
    fetch === globalThis.fetch
  ) {
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

      if (SUPPORTS_REQUEST_INIT_DISPATCHER) {
        // @ts-expect-error non-standard option
        const request = new Request(input, { ...init, dispatcher })
        return fetch.call(this, request)
      } else {
        // @ts-expect-error non-standard option
        return fetch.call(this, input, { ...init, dispatcher })
      }
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
          // hostname is a domain name, let's create a new dispatcher that
          // will 1) use the unicastLookup function to resolve the hostname
          // and 2) allow us to check that the lookup function was indeed
          // called.

          let didLookup = false
          const dispatcher = new Client(url.origin, {
            // Do *not* enable H2 here, as it will cause an error (the
            // client will terminate the connection before the response is
            // consumed).
            // https://github.com/nodejs/undici/issues/3671
            connect: {
              keepAlive: false, // Client will be used once
              lookup(...args) {
                didLookup = true
                unicastLookup(...args)
              },
            },
          })

          try {
            const headers = new Headers(init?.headers)
            headers.set('connection', 'close') // Proactively close the connection

            const response = await fetch.call(this, input, {
              ...init,
              headers,
              // @ts-expect-error non-standard option
              dispatcher,
            })

            if (!didLookup) {
              // We need to ensure that the body is discarded. We can either
              // consume the whole body (for await loop) in order to keep the
              // socket alive, or cancel the request. Since we sent "connection:
              // close", there is no point in consuming the whole response
              // (which would cause un-necessary bandwidth).
              //
              // https://undici.nodejs.org/#/?id=garbage-collection
              await response.body?.cancel()

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

            return response
          } finally {
            // Free resources (we cannot await here since the response was not
            // consumed yet).
            void dispatcher.close().catch((err) => {
              // No biggie, but let's still log it
              console.warn('Failed to close dispatcher', err)
            })
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

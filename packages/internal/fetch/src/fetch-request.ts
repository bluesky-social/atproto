import { FetchError } from './fetch-error.js'
import { asRequest } from './fetch.js'
import { isIp } from './util.js'

const extractUrl = (input: Request | string | URL) =>
  typeof input === 'string'
    ? new URL(input)
    : input instanceof URL
      ? input
      : new URL(input.url)

export function protocolCheckRequestTransform(protocols: Iterable<string>) {
  const allowedProtocols = new Set<string>(protocols)

  return (input: Request | string | URL, init?: RequestInit) => {
    const { protocol } = extractUrl(input)

    if (!allowedProtocols.has(protocol)) {
      throw new FetchError(400, `${protocol} is not allowed`)
    }

    return asRequest(input, init)
  }
}

export function requireHostHeaderTranform() {
  return (input: Request | string | URL, init?: RequestInit) => {
    // Note that fetch() will automatically add the Host header from the URL and
    // discard any Host header manually set in the request.

    const { protocol, hostname } = extractUrl(input)

    // "Host" header only makes sense in the context of an HTTP request
    if (protocol !== 'http:' && protocol !== 'https') {
      throw new FetchError(400, `Forbidden protocol ${protocol}`)
    }

    if (!hostname || isIp(hostname)) {
      throw new FetchError(400, 'Invalid hostname')
    }

    return asRequest(input, init)
  }
}

export const DEFAULT_FORBIDDEN_DOMAIN_NAMES = [
  'example.com',
  '*.example.com',
  'example.org',
  '*.example.org',
  'example.net',
  '*.example.net',
  'googleusercontent.com',
  '*.googleusercontent.com',
]

export function forbiddenDomainNameRequestTransform(
  denyList: Iterable<string> = DEFAULT_FORBIDDEN_DOMAIN_NAMES,
) {
  const denySet = new Set<string>(denyList)

  // Optimization: if no forbidden domain names are provided, we can skip the
  // check entirely.
  if (denySet.size === 0) {
    return async (request) => request
  }

  return async (input: Request | string | URL, init?: RequestInit) => {
    const { hostname } = extractUrl(input)

    // Full domain name check
    if (denySet.has(hostname)) {
      throw new FetchError(403, 'Forbidden hostname')
    }

    // Sub domain name check
    let curDot = hostname.indexOf('.')
    while (curDot !== -1) {
      const subdomain = hostname.slice(curDot + 1)
      if (denySet.has(`*.${subdomain}`)) {
        throw new FetchError(403, 'Forbidden hostname')
      }
      curDot = hostname.indexOf('.', curDot + 1)
    }

    return asRequest(input, init)
  }
}

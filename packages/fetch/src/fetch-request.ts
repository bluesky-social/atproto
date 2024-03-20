import { Transformer } from '@atproto/transformer'

import { FetchError } from './fetch-error.js'

export type RequestTranformer = Transformer<Request>

export function protocolCheckRequestTransform(
  protocols: Iterable<string>,
): RequestTranformer {
  const allowedProtocols = new Set<string>(protocols)

  return async (request) => {
    const { protocol } = new URL(request.url)

    if (!allowedProtocols.has(protocol)) {
      throw new FetchError(400, `${protocol} is not allowed`, { request })
    }

    return request
  }
}

export function requireHostHeaderTranform(): RequestTranformer {
  return async (request) => {
    // Note that fetch() will automatically add the Host header from the URL and
    // discard any Host header manually set in the request.

    const { hostname } = new URL(request.url)

    // IPv4
    if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      throw new FetchError(400, 'Invalid hostname', { request })
    }

    // IPv6
    if (hostname.startsWith('[') || hostname.endsWith(']')) {
      throw new FetchError(400, 'Invalid hostname', { request })
    }

    return request
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
): RequestTranformer {
  const denySet = new Set<string>(denyList)

  // Optimization: if no forbidden domain names are provided, we can skip the
  // check entirely.
  if (denySet.size === 0) {
    return async (request) => request
  }

  return async (request) => {
    const { hostname } = new URL(request.url)

    // Full domain name check
    if (denySet.has(hostname)) {
      throw new FetchError(403, 'Forbidden hostname', { request })
    }

    // Sub domain name check
    let curDot = hostname.indexOf('.')
    while (curDot !== -1) {
      const subdomain = hostname.slice(curDot + 1)
      if (denySet.has(`*.${subdomain}`)) {
        throw new FetchError(403, 'Forbidden hostname', { request })
      }
      curDot = hostname.indexOf('.', curDot + 1)
    }

    return request
  }
}

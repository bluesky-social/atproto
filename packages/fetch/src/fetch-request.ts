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

export function forbiddenDomainNameRequestTransform(
  forbiddenDomainNames: Iterable<string>,
): RequestTranformer {
  const forbiddenDomainNameSet = new Set<string>(forbiddenDomainNames)
  if (forbiddenDomainNameSet.size === 0) return (request) => request

  return async (request) => {
    const { hostname } = new URL(request.url)

    // IPv4
    if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      throw new FetchError(400, 'Invalid hostname', { request })
    }

    // IPv6
    if (hostname.startsWith('[') || hostname.endsWith(']')) {
      throw new FetchError(400, 'Invalid hostname', { request })
    }

    if (forbiddenDomainNameSet.has(hostname)) {
      throw new FetchError(403, 'Forbidden hostname', { request })
    }

    return request
  }
}

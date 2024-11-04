import { FetchError } from './fetch-error.js'
import { asRequest } from './fetch.js'
import { extractUrl, isIp } from './util.js'

export class FetchRequestError extends FetchError {
  constructor(
    public readonly request: Request,
    statusCode?: number,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(statusCode, message, options)
  }

  static from(request: Request, cause: unknown): FetchRequestError {
    if (cause instanceof FetchRequestError) return cause
    return new FetchRequestError(request, undefined, undefined, { cause })
  }
}

export function protocolCheckRequestTransform(protocols: {
  'about:'?: boolean
  'blob:'?: boolean
  'data:'?: boolean
  'file:'?: boolean
  'http:'?: boolean | { allowCustomPort: boolean }
  'https:'?: boolean | { allowCustomPort: boolean }
}) {
  return (input: Request | string | URL, init?: RequestInit) => {
    const { protocol, port } = extractUrl(input)

    const request = asRequest(input, init)

    const config: undefined | boolean | { allowCustomPort?: boolean } =
      Object.hasOwn(protocols, protocol) ? protocols[protocol] : undefined

    if (!config) {
      throw new FetchRequestError(
        request,
        400,
        `Forbidden protocol "${protocol}"`,
      )
    } else if (config === true) {
      // Safe to proceed
    } else if (!config['allowCustomPort'] && port !== '') {
      throw new FetchRequestError(
        request,
        400,
        `Custom ${protocol} ports not allowed`,
      )
    }

    return request
  }
}

export function redirectCheckRequestTransform() {
  return (input: Request | string | URL, init?: RequestInit) => {
    const request = asRequest(input, init)

    if (request.redirect === 'follow') {
      throw new FetchRequestError(
        request,
        500,
        'Request redirect must be "error" or "manual"',
      )
    }

    return request
  }
}

export function requireHostHeaderTransform() {
  return (input: Request | string | URL, init?: RequestInit) => {
    // Note that fetch() will automatically add the Host header from the URL and
    // discard any Host header manually set in the request.

    const { protocol, hostname } = extractUrl(input)

    const request = asRequest(input, init)

    // "Host" header only makes sense in the context of an HTTP request
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new FetchRequestError(
        request,
        400,
        `"${protocol}" requests are not allowed`,
      )
    }

    if (!hostname || isIp(hostname)) {
      throw new FetchRequestError(request, 400, 'Invalid hostname')
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
) {
  const denySet = new Set<string>(denyList)

  // Optimization: if no forbidden domain names are provided, we can skip the
  // check entirely.
  if (denySet.size === 0) {
    return asRequest
  }

  return async (input: Request | string | URL, init?: RequestInit) => {
    const { hostname } = extractUrl(input)

    const request = asRequest(input, init)

    // Full domain name check
    if (denySet.has(hostname)) {
      throw new FetchRequestError(request, 403, 'Forbidden hostname')
    }

    // Sub domain name check
    let curDot = hostname.indexOf('.')
    while (curDot !== -1) {
      const subdomain = hostname.slice(curDot + 1)
      if (denySet.has(`*.${subdomain}`)) {
        throw new FetchRequestError(request, 403, 'Forbidden hostname')
      }
      curDot = hostname.indexOf('.', curDot + 1)
    }

    return request
  }
}

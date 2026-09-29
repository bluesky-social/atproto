import { FetchError } from './fetch-error.js'
import { asRequest } from './fetch.js'
import { isIp } from './util.js'

export class FetchRequestError extends FetchError {
  constructor(
    public readonly request: Request,
    statusCode?: number,
    message?: string,
    options?: ErrorOptions,
  ) {
    if (statusCode == null || !message) {
      const info = extractInfo(extractRootCause(options?.cause))
      statusCode ??= info[0]
      message ||= info[1]
    }

    super(statusCode, message, options)
  }

  get expose() {
    // A 500 request error means that the request was not made due to an infra,
    // programming or server side issue. The message should no be exposed to
    // downstream clients.
    return this.statusCode !== 500
  }

  static from(request: Request, cause: unknown): FetchRequestError {
    if (cause instanceof FetchRequestError) return cause
    return new FetchRequestError(request, undefined, undefined, { cause })
  }
}

function extractRootCause(err: unknown): unknown {
  // Unwrap the Network error from undici (i.e. Node's internal fetch() implementation)
  // https://github.com/nodejs/undici/blob/3274c975947ce11a08508743df026f73598bfead/lib/web/fetch/index.js#L223-L228
  if (
    err instanceof TypeError &&
    err.message === 'fetch failed' &&
    err.cause !== undefined
  ) {
    return err.cause
  }

  return err
}

function extractInfo(err: unknown): [statusCode: number, message: string] {
  if (typeof err === 'string' && err.length > 0) {
    return [500, err]
  }

  if (!(err instanceof Error)) {
    return [500, 'Failed to fetch']
  }

  // Undici fetch() "network" errors
  switch (err.message) {
    case 'failed to fetch the data URL':
      return [400, err.message]
    case 'unexpected redirect':
    case 'cors failure':
    case 'blocked':
    case 'proxy authentication required':
      // These cases could be represented either as a 4xx user error (invalid
      // URL provided), or as a 5xx server error (server didn't behave as
      // expected).
      return [502, err.message]
  }

  // NodeJS errors
  const code = 'code' in err ? err.code : undefined
  if (typeof code === 'string') {
    switch (true) {
      case code === 'ENOTFOUND':
        return [400, 'Invalid hostname']
      case code === 'ECONNREFUSED':
        return [502, 'Connection refused']
      case code === 'DEPTH_ZERO_SELF_SIGNED_CERT':
        return [502, 'Self-signed certificate']
      case code.startsWith('ERR_TLS'):
        return [502, 'TLS error']
      case code.startsWith('ECONN'):
        return [502, 'Connection error']
      default:
        return [500, `${code} error`]
    }
  }

  return [500, err.message]
}

export type ProtocolConfig = {
  'about:'?: boolean
  'blob:'?: boolean
  'data:'?: boolean
  'file:'?: boolean
  'http:'?: boolean | { allowCustomPort: boolean }
  'https:'?: boolean | { allowCustomPort: boolean }
}

/**
 * The url policy checks below return the reason a url is unacceptable, or
 * `undefined` when it is fine.
 *
 * @note They are expressed over a {@link URL} rather than a {@link Request} so
 * that the same policy can be applied both to the initial url (by the request
 * transforms below) and to every redirect hop (by
 * `@atproto-labs/fetch-node`'s dispatcher guard, which only ever sees an
 * origin). Keep them free of request state, and of path or query state, for
 * that reason.
 *
 * @note They deliberately carry no status code. The appropriate status depends
 * on how the caller surfaces the failure, so it belongs at the throw site.
 */
export type UrlPolicyReason = string

export function checkProtocolPolicy(
  url: URL,
  protocols: ProtocolConfig,
): UrlPolicyReason | undefined {
  const { protocol, port } = url

  const config: undefined | boolean | { allowCustomPort?: boolean } =
    Object.hasOwn(protocols, protocol)
      ? protocols[protocol as keyof ProtocolConfig]
      : undefined

  if (!config) {
    return `Forbidden protocol "${protocol}"`
  } else if (config === true) {
    return undefined
  } else if (!config['allowCustomPort'] && port !== '') {
    return `Custom ${protocol} ports not allowed`
  }

  return undefined
}

export function checkHostHeaderPolicy(url: URL): UrlPolicyReason | undefined {
  const { protocol, hostname } = url

  // "Host" header only makes sense in the context of an HTTP request
  if (protocol !== 'http:' && protocol !== 'https:') {
    return `"${protocol}" requests are not allowed`
  }

  if (!hostname || isIp(hostname)) {
    return 'Invalid hostname'
  }

  return undefined
}

export function checkForbiddenDomainNamePolicy(
  url: URL,
  denySet: ReadonlySet<string>,
): UrlPolicyReason | undefined {
  const { hostname } = url

  // Full domain name check
  if (denySet.has(hostname)) {
    return 'Forbidden hostname'
  }

  // Sub domain name check
  let curDot = hostname.indexOf('.')
  while (curDot !== -1) {
    const subdomain = hostname.slice(curDot + 1)
    if (denySet.has(`*.${subdomain}`)) {
      return 'Forbidden hostname'
    }
    curDot = hostname.indexOf('.', curDot + 1)
  }

  return undefined
}

export function protocolCheckRequestTransform(protocols: ProtocolConfig) {
  return (input: Request | string | URL, init?: RequestInit) => {
    const request = asRequest(input, init)

    const reason = checkProtocolPolicy(new URL(request.url), protocols)
    if (reason) throw new FetchRequestError(request, 400, reason)

    return request
  }
}

export function explicitRedirectCheckRequestTransform() {
  return (input: Request | string | URL, init?: RequestInit): Request => {
    const request = asRequest(input, init)

    // We want to avoid the case where the user of this code forgot to explicit
    // a redirect strategy.
    if (init?.redirect != null) return request

    // Sadly, if the `input` is a request, and `init` was omitted, there is no
    // way to tell if the `redirect === 'follow'` value comes from the user, or
    // fetch's default. In order to prevent accidental omission, this case is
    // forbidden.
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

    const request = asRequest(input, init)

    const reason = checkHostHeaderPolicy(new URL(request.url))
    if (reason) throw new FetchRequestError(request, 400, reason)

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
    const request = asRequest(input, init)

    const reason = checkForbiddenDomainNamePolicy(new URL(request.url), denySet)
    if (reason) throw new FetchRequestError(request, 403, reason)

    return request
  }
}

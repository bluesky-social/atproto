import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import forwarded from 'forwarded'
import createHttpError from 'http-errors'
import { appendHeader } from './response.js'
import { UrlReference, urlMatch } from './url.js'

export function validateHeaderValue(
  req: IncomingMessage,
  name: keyof IncomingMessage['headers'],
  allowedValues: readonly (string | null)[],
) {
  const value = req.headers[name] ?? null

  if (Array.isArray(value)) {
    throw createHttpError(400, `Invalid ${name} header`)
  }

  if (!allowedValues.includes(value)) {
    throw createHttpError(
      400,
      value
        ? `Forbidden ${name} header "${value}" (expected ${allowedValues})`
        : `Missing ${name} header`,
    )
  }
}

export function validateFetchMode(
  req: IncomingMessage,
  res: ServerResponse,
  expectedMode: readonly (
    | null
    | 'navigate'
    | 'same-origin'
    | 'no-cors'
    | 'cors'
  )[],
) {
  validateHeaderValue(req, 'sec-fetch-mode', expectedMode)
}

export function validateFetchDest(
  req: IncomingMessage,
  res: ServerResponse,
  expectedDest: readonly (
    | null
    | 'document'
    | 'embed'
    | 'font'
    | 'image'
    | 'manifest'
    | 'media'
    | 'object'
    | 'report'
    | 'script'
    | 'serviceworker'
    | 'sharedworker'
    | 'style'
    | 'worker'
    | 'xslt'
  )[],
) {
  validateHeaderValue(req, 'sec-fetch-dest', expectedDest)
}

export function validateFetchSite(
  req: IncomingMessage,
  res: ServerResponse,
  expectedSite: readonly (
    | null
    | 'same-origin'
    | 'same-site'
    | 'cross-site'
    | 'none'
  )[],
) {
  validateHeaderValue(req, 'sec-fetch-site', expectedSite)
}

export function validateReferer(
  req: IncomingMessage,
  res: ServerResponse,
  reference: UrlReference,
  allowNull = false,
) {
  const referer = req.headers['referer']
  const refererUrl = referer ? new URL(referer) : null
  if (refererUrl ? !urlMatch(refererUrl, reference) : !allowNull) {
    throw createHttpError(400, `Invalid referer ${referer}`)
  }
}

export async function setupCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
  cookieName = 'csrf_token',
) {
  const csrfToken = randomBytes(8).toString('hex')
  appendHeader(
    res,
    'Set-Cookie',
    serializeCookie(cookieName, csrfToken, {
      secure: true,
      httpOnly: false,
      sameSite: 'lax',
      path: req.url?.split('?', 1)[0] || '/',
    }),
  )
}

// CORS ensure not cross origin
export function validateSameOrigin(
  req: IncomingMessage,
  res: ServerResponse,
  origin: string,
  allowNull = true,
) {
  const reqOrigin = req.headers['origin']
  if (reqOrigin ? reqOrigin !== origin : !allowNull) {
    throw createHttpError(400, `Invalid origin ${reqOrigin}`)
  }
}

export function validateCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
  csrfToken: string,
  cookieName = 'csrf_token',
  clearCookie = false,
) {
  const cookies = parseHttpCookies(req)
  if (
    !csrfToken ||
    !cookies ||
    !cookieName ||
    cookies[cookieName] !== csrfToken
  ) {
    throw createHttpError(400, `Invalid CSRF token`)
  }

  if (clearCookie) {
    appendHeader(
      res,
      'Set-Cookie',
      serializeCookie(cookieName, '', {
        secure: true,
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 0,
      }),
    )
  }
}

export function parseHttpCookies(
  req: IncomingMessage,
): null | Record<string, undefined | string> {
  return 'cookies' in req && req.cookies // Already parsed by another middleware
    ? (req.cookies as any)
    : req.headers['cookie']
      ? ((req as any).cookies = parseCookie(req.headers['cookie']))
      : null
}

export type ExtractRequestMetadataOptions = {
  /**
   * A function that determines whether a given IP address is trusted. The
   * function is called with the IP addresses and its index in the list of
   * forwarded addresses (starting from 0, 0 corresponding to the ip of the
   * incoming HTTP connection, and the last item being the first proxied IP
   * address in the proxy chain, deduced from the `X-Forwarded-For` header). The
   * function should return `true` if the IP address is trusted, and `false`
   * otherwise.
   *
   * @see {@link https://www.npmjs.com/package/proxy-addr} for a utility that
   * allows you to create a trust function.
   */
  trustProxy?: (addr: string, i: number) => boolean
}

export type RequestMetadata = {
  userAgent?: string
  ipAddress: string
  port: number
}

export function extractRequestMetadata(
  req: IncomingMessage,
  options?: ExtractRequestMetadataOptions,
): RequestMetadata {
  const ip = extractIp(req, options)
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: ip,
    port: extractPort(req, ip),
  }
}

function extractIp(
  req: IncomingMessage,
  options?: ExtractRequestMetadataOptions,
): string {
  const trust = options?.trustProxy
  if (trust) {
    const ips = forwarded(req)
    for (let i = 0; i < ips.length; i++) {
      const isTrusted = trust(ips[i], i)
      if (!isTrusted) return ips[i]
    }
    // Let's return the last ("furthest") IP address in the chain if all of them
    // are trusted. Note that this may indicate an issue with either the trust
    // function (too permissive), or the proxy configuration (one of them not
    // setting the X-Forwarded-For header).
    const ip = ips[ips.length - 1]
    if (ip) return ip
  }

  // Express app compatibility (see "trust proxy" setting)
  if ('ip' in req) {
    const ip = req.ip
    if (typeof ip === 'string') return ip
  }

  const ip = req.socket.remoteAddress
  if (ip) return ip

  throw new Error('Could not determine IP address')
}

function extractPort(req: IncomingMessage, ip: string): number {
  if (ip !== req.socket.remoteAddress) {
    // Trust the X-Forwarded-Port header only if the IP address was a trusted
    // proxied IP.
    const forwardedPort = req.headers['x-forwarded-port']
    if (typeof forwardedPort === 'string') {
      const port = Number(forwardedPort.trim())
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('Invalid forwarded port')
      }
      return port
    }
  }

  const port = req.socket.remotePort
  if (port != null) return port

  throw new Error('Could not determine port')
}

import type { IncomingMessage, ServerResponse } from 'node:http'
import { languages, mediaType } from '@hapi/accept'
import {
  CookieSerializeOptions,
  parse as parseCookie,
  serialize as serializeCookie,
} from 'cookie'
import forwarded from 'forwarded'
import createHttpError from 'http-errors'
import { appendHeader } from './headers.js'
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

export function validateReferrer(
  req: IncomingMessage,
  reference: UrlReference,
  allowNull: true,
): URL | null
export function validateReferrer(
  req: IncomingMessage,
  reference: UrlReference,
  allowNull?: false,
): URL
export function validateReferrer(
  req: IncomingMessage,
  reference: UrlReference,
  allowNull = false,
) {
  // @NOTE The header name "referer" is actually a misspelling of the word
  // "referrer". https://en.wikipedia.org/wiki/HTTP_referer
  const referrer = req.headers['referer']
  const referrerUrl = referrer ? new URL(referrer) : null
  if (referrerUrl ? !urlMatch(referrerUrl, reference) : !allowNull) {
    throw createHttpError(400, `Invalid referrer ${referrer}`)
  }
  return referrerUrl
}

export function validateOrigin(
  req: IncomingMessage,
  expectedOrigin: string,
  optional = true,
) {
  const reqOrigin = req.headers['origin']
  if (reqOrigin ? reqOrigin !== expectedOrigin : !optional) {
    throw createHttpError(400, `Invalid origin ${reqOrigin}`)
  }
}

export type { CookieSerializeOptions }

export function setCookie(
  res: ServerResponse,
  cookieName: string,
  value: string,
  options?: CookieSerializeOptions,
) {
  appendHeader(res, 'Set-Cookie', serializeCookie(cookieName, value, options))
}

export function clearCookie(
  res: ServerResponse,
  cookieName: string,
  options?: Omit<CookieSerializeOptions, 'maxAge' | 'expires'>,
) {
  setCookie(res, cookieName, '', { ...options, maxAge: 0 })
}

export function parseHttpCookies(
  req: IncomingMessage & { cookies?: any },
): Record<string, undefined | string> {
  req.cookies ??= req.headers['cookie']
    ? parseCookie(req.headers['cookie'])
    : Object.create(null)
  return req.cookies
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

export function extractLocales(req: IncomingMessage) {
  const acceptLanguage = req.headers['accept-language']
  return acceptLanguage ? languages(acceptLanguage) : []
}

export function negotiateResponseContent<T extends string>(
  req: IncomingMessage,
  types: readonly T[],
): T | undefined {
  const type = mediaType(req.headers['accept'], types)
  if (type) return type as T

  return undefined
}

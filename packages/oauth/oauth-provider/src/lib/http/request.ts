import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { randomBytes } from 'crypto'
import createHttpError from 'http-errors'

import { appendHeader } from './response.js'
import { IncomingMessage, ServerResponse } from './types.js'
import { urlMatch, UrlReference } from './url.js'

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

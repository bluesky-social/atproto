import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import {
  CookieSerializeOptions,
  parseHttpCookies,
  setCookie,
} from '../lib/http/index.js'
import { RequestUri } from '../request/request-uri.js'

// @NOTE Cookie based CSRF protection is redundant with session cookies using
// `SameSite` and could probably be removed in the future.
const CSRF_COOKIE_OPTIONS: Readonly<CookieSerializeOptions> = Object.freeze({
  expires: undefined, // "session" cookie
  secure: true,
  httpOnly: false, // Need to be accessible from JavaScript
  sameSite: 'lax',
})

export function csrfCookieName(requestUri?: RequestUri) {
  return requestUri ? `csrf-${requestUri}` : 'csrf-token'
}

export function clearCsrfToken(res: ServerResponse, requestUri?: RequestUri) {
  const cookieName = csrfCookieName(requestUri)
  setCookie(res, cookieName, '<invalid>', CSRF_COOKIE_OPTIONS)
}

export function setupCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
  requestUri?: RequestUri,
) {
  const cookies = parseHttpCookies(req)
  const cookieName = csrfCookieName(requestUri)
  const csrfToken = cookies[cookieName] || randomBytes(8).toString('hex')
  setCookie(res, cookieName, csrfToken, CSRF_COOKIE_OPTIONS)
}

export function validateCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
  requestUri?: RequestUri,
  csrfToken: unknown = req.headers['x-csrf-token'],
) {
  const cookieName = csrfCookieName(requestUri)
  const cookies = parseHttpCookies(req)
  if (
    typeof csrfToken !== 'string' ||
    !csrfToken ||
    !cookies ||
    !cookieName ||
    cookies[cookieName] !== csrfToken
  ) {
    throw createHttpError(400, `Invalid CSRF token`)
  }
  // Refresh cookie (See Chrome's "Lax+POST" behavior)
  setCookie(res, cookieName, csrfToken, CSRF_COOKIE_OPTIONS)
}

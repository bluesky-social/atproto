import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import {
  CookieSerializeOptions,
  parseHttpCookies,
  setCookie,
} from '../lib/http/index.js'
import { RequestUri } from '../request/request-uri.js'

const CSRF_COOKIE_OPTIONS: Readonly<CookieSerializeOptions> = Object.freeze({
  expires: undefined, // "session" cookie
  secure: true,
  httpOnly: false,
  sameSite: 'lax',
})

export function csrfCookieName(requestUri?: RequestUri) {
  return requestUri ? `csrf-${requestUri}` : 'csrf-token'
}

export function clearCsrfToken(res: ServerResponse, requestUri?: RequestUri) {
  const cookieName = csrfCookieName(requestUri)
  setCookie(res, cookieName, '<invalid>', CSRF_COOKIE_OPTIONS)
}

export function setupCsrfToken(res: ServerResponse, requestUri?: RequestUri) {
  const cookieName = csrfCookieName(requestUri)
  const csrfToken = randomBytes(8).toString('hex')
  setCookie(res, cookieName, csrfToken, CSRF_COOKIE_OPTIONS)
}

export function validateCsrfToken(
  req: IncomingMessage,
  csrfToken: unknown,
  requestUri?: RequestUri,
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
}

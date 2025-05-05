import type { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@atproto/oauth-provider-api'
import {
  CookieSerializeOptions,
  parseHttpCookies,
  setCookie,
} from '../../lib/http/index.js'
import { randomHexId } from '../../lib/util/crypto.js'

const TOKEN_BYTE_LENGTH = 12
const TOKEN_LENGTH = TOKEN_BYTE_LENGTH * 2 // 2 hex chars per byte

// @NOTE Cookie based CSRF protection is redundant with session cookies using
// `SameSite` and could probably be removed in the future.
const CSRF_COOKIE_OPTIONS: Readonly<CookieSerializeOptions> = {
  expires: undefined, // "session" cookie
  secure: true,
  httpOnly: false, // Need to be accessible from JavaScript
  sameSite: 'lax',
  path: `/`,
}

export async function setupCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<string> {
  const token = getCookieCsrf(req) || (await randomHexId(TOKEN_BYTE_LENGTH))

  // Refresh cookie (See Chrome's "Lax+POST" behavior)
  setCookie(res, CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS)

  return token
}

export async function validateCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const cookieValue = await setupCsrfToken(req, res)
  const headerValue = getHeadersCsrf(req)

  if (cookieValue !== headerValue) {
    throw createHttpError(400, `CSRF mismatch`)
  }
}

function getCookieCsrf(req: IncomingMessage) {
  const cookies = parseHttpCookies(req)
  const cookieValue = cookies[CSRF_COOKIE_NAME]
  if (cookieValue?.length === TOKEN_LENGTH) {
    return cookieValue
  }
  return undefined
}

function getHeadersCsrf(req: IncomingMessage) {
  const headerValue = req.headers[CSRF_HEADER_NAME]
  if (typeof headerValue === 'string' && headerValue.length === TOKEN_LENGTH) {
    return headerValue
  }
  return undefined
}

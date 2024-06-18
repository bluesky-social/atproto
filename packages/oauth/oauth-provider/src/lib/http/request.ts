import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { randomBytes } from 'crypto'
import createHttpError from 'http-errors'
import { z } from 'zod'

import { KnownNames } from './parser.js'
import { appendHeader } from './response.js'
import { decodeStream, parseStream } from './stream.js'
import { IncomingMessage, ServerResponse } from './types.js'
import { UrlReference, urlMatch } from './url.js'

export function parseRequestPayload<
  A extends readonly KnownNames[] = readonly KnownNames[],
>(req: IncomingMessage, allow?: A) {
  return parseStream(
    decodeStream(req, req.headers['content-encoding']),
    req.headers['content-type'],
    allow,
  )
}

export async function validateRequestPayload<S extends z.ZodTypeAny>(
  req: IncomingMessage,
  schema: S,
  allow: readonly KnownNames[] = ['json', 'urlencoded'],
): Promise<z.infer<S>> {
  const payload = await parseRequestPayload(req, allow)
  return schema.parseAsync(payload, { path: ['body'] })
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
  const reqMode = req.headers['sec-fetch-mode'] ?? null

  if (Array.isArray(reqMode)) {
    throw createHttpError(400, `Invalid sec-fetch-mode header`)
  }

  if (!(expectedMode as (string | null)[]).includes(reqMode)) {
    throw createHttpError(
      403,
      reqMode
        ? `Forbidden sec-fetch-mode "${reqMode}" (expected ${expectedMode})`
        : `Missing sec-fetch-mode (expected ${expectedMode})`,
    )
  }
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
    throw createHttpError(403, `Invalid referer ${referer}`)
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
    throw createHttpError(403, `Invalid origin ${reqOrigin}`)
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
    throw createHttpError(403, `Invalid CSRF token`)
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

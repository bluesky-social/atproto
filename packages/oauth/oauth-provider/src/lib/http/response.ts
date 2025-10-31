import type { IncomingMessage, ServerResponse } from 'node:http'
import { type Readable, pipeline } from 'node:stream'
import createHttpError from 'http-errors'
import { Awaitable } from '../util/type.js'
import { negotiateResponseContent } from './request.js'
import {
  SecurityHeadersOptions,
  setSecurityHeaders,
} from './security-headers.js'
import type { Handler, Middleware } from './types.js'

export function writeRedirect(
  res: ServerResponse,
  url: string,
  status = 302,
): void {
  res.writeHead(status, { Location: url }).end()
}

export type WriteResponseOptions = {
  status?: number
  contentType?: string
}

export function writeStream(
  res: ServerResponse,
  stream: Readable,
  {
    status = 200,
    contentType = 'application/octet-stream',
  }: WriteResponseOptions = {},
): void {
  res.statusCode = status
  res.setHeader('content-type', contentType)

  if (res.req.method === 'HEAD') {
    res.end()
    stream.destroy()
  } else {
    pipeline([stream, res], (_err: Error | null) => {
      // The error will be propagated through the streams
    })
  }
}

export function writeBuffer(
  res: ServerResponse,
  chunk: string | Buffer,
  opts: WriteResponseOptions,
): void {
  if (opts?.status != null) res.statusCode = opts.status
  res.setHeader('content-type', opts?.contentType || 'application/octet-stream')
  res.end(chunk)
}

export function toJsonBuffer(value: unknown): Buffer {
  try {
    return Buffer.from(JSON.stringify(value))
  } catch (cause) {
    throw new Error(`Failed to serialize as JSON`, { cause })
  }
}

export function writeJson(
  res: ServerResponse,
  payload: unknown,
  { contentType = 'application/json', ...options }: WriteResponseOptions = {},
): void {
  const buffer = toJsonBuffer(payload)
  writeBuffer(res, buffer, { ...options, contentType })
}

export function staticJsonMiddleware(
  value: unknown,
  { contentType = 'application/json', ...options }: WriteResponseOptions = {},
): Handler<unknown> {
  const buffer = toJsonBuffer(value)
  const staticOptions: WriteResponseOptions = { ...options, contentType }
  return function (req, res) {
    writeBuffer(res, buffer, staticOptions)
  }
}

export type WriteHtmlOptions = WriteResponseOptions & SecurityHeadersOptions

export function writeHtml(
  res: ServerResponse,
  html: Buffer | string,
  { contentType = 'text/html', ...options }: WriteHtmlOptions = {},
): void {
  // HTML pages should always be served with safety protection headers
  setSecurityHeaders(res, options)
  writeBuffer(res, html, { ...options, contentType })
}

export function cacheControlMiddleware(maxAge: number): Middleware<void> {
  const header = `max-age=${maxAge}`
  return function (req, res, next) {
    res.setHeader('Cache-Control', header)
    next()
  }
}

export type JsonResponse<P = unknown> = WriteResponseOptions & {
  json: P
}

export function jsonHandler<
  T,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  buildJson: (this: T, req: Req, res: Res) => Awaitable<JsonResponse>,
): Middleware<T, Req, Res> {
  return function (req, res, next) {
    // Ensure we can agree on a content encoding & type before starting to
    // build the JSON response.
    if (negotiateResponseContent(req, ['application/json'])) {
      // A middleware should not be async, so we wrap the async operation in a
      // promise and return it.
      void (async () => {
        try {
          const jsonResponse = await buildJson.call(this, req, res)
          const { json, status = 200, ...options } = jsonResponse
          writeJson(res, json, { ...options, status })
        } catch (err) {
          next(asError(err, 'Failed to build JSON response'))
        }
      })()
    } else {
      next(createHttpError(406, 'Unsupported media type'))
    }
  }
}

function asError(cause: unknown, message: string): Error {
  return cause instanceof Error ? cause : new Error(message, { cause })
}

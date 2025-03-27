import type { ServerResponse } from 'node:http'
import { type Readable, pipeline } from 'node:stream'
import {
  SecurityHeadersOptions,
  setSecurityHeaders,
} from './security-headers.js'
import type { Handler, Middleware } from './types.js'

export function appendHeader(
  res: ServerResponse,
  header: string,
  value: string | readonly string[],
): void {
  const existing = res.getHeader(header)
  if (existing == null) {
    res.setHeader(header, value)
  } else {
    const arr = Array.isArray(existing) ? existing : [String(existing)]
    res.setHeader(header, arr.concat(value))
  }
}

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

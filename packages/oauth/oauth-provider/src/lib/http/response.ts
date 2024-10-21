import { Readable, pipeline } from 'node:stream'

import { Middleware, ServerResponse } from './types.js'

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

const ifString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

export type WriteResponseOptions = {
  status?: number
  contentType?: string
}

export function writeStream(
  res: ServerResponse,
  stream: Readable,
  {
    status = 200,
    contentType = ifString((stream as any).headers?.['content-type']) ||
      'application/octet-stream',
  }: WriteResponseOptions = {},
): void {
  res.statusCode = status
  res.setHeader('content-type', contentType)
  appendHeader(res, 'vary', 'accept-encoding')

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
  buffer: Buffer,
  options?: WriteResponseOptions,
): void {
  const stream = Readable.from([buffer])
  writeStream(res, stream, options)
}

export function writeJson(
  res: ServerResponse,
  payload: unknown,
  { contentType = 'application/json', ...options }: WriteResponseOptions = {},
): void {
  const buffer = Buffer.from(JSON.stringify(payload))
  writeBuffer(res, buffer, { contentType, ...options })
}

export function staticJsonMiddleware(
  value: unknown,
  { contentType = 'application/json', ...options }: WriteResponseOptions = {},
): Middleware<unknown> {
  const buffer = Buffer.from(JSON.stringify(value))
  const staticOptions: WriteResponseOptions = { contentType, ...options }
  return function (req, res, next) {
    try {
      writeBuffer(res, buffer, staticOptions)
    } catch (err) {
      next(err)
    }
  }
}

export function writeHtml(
  res: ServerResponse,
  html: Buffer | string,
  { contentType = 'text/html', ...options }: WriteResponseOptions = {},
): void {
  const buffer = Buffer.isBuffer(html) ? html : Buffer.from(html)
  writeBuffer(res, buffer, { contentType, ...options })
}

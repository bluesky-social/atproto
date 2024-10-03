import { encoding } from '@hapi/accept'
import createHttpError from 'http-errors'
import { Readable, Transform, pipeline } from 'node:stream'
import { constants, createBrotliCompress, createGzip } from 'node:zlib'

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

function negotiateEncoding(acceptEncoding?: string | string[]) {
  const accept = Array.isArray(acceptEncoding)
    ? acceptEncoding.join(',')
    : acceptEncoding

  const result = encoding(accept, ['gzip', 'br', 'identity'])
  if (!result) {
    throw createHttpError(406, 'Unsupported encoding')
  }

  return result as 'gzip' | 'br' | 'identity'
}

function getEncoder(
  encoding: 'gzip' | 'br' | 'identity' | undefined,
): Transform | null {
  if (encoding === 'gzip') {
    return createGzip()
  }

  if (encoding === 'br') {
    return createBrotliCompress({
      // Default quality is too slow
      params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
    })
  }

  return null
}

const ifString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

type WriteResponseOptions = {
  status?: number
  contentType?: string
  contentEncoding?: 'gzip' | 'br' | 'identity'
}

export function writeStream(
  res: ServerResponse,
  stream: Readable,
  {
    status = 200,
    contentType = ifString((stream as any).headers?.['content-type']) ||
      'application/octet-stream',
    contentEncoding = negotiateEncoding(res.req.headers['accept-encoding']),
  }: WriteResponseOptions = {},
): void {
  res.statusCode = status
  res.setHeader('content-type', contentType)
  appendHeader(res, 'vary', 'accept-encoding')

  if (contentEncoding !== 'identity') {
    res.setHeader('content-encoding', contentEncoding)
  } else {
    res.removeHeader('content-encoding')
  }

  res.setHeader('transfer-encoding', 'chunked')

  if (res.req.method === 'HEAD') {
    res.end()
    stream.destroy()
    return
  }

  const encoder = getEncoder(contentEncoding)

  pipeline(
    encoder ? [stream, encoder, res] : [stream, res],
    (_err: Error | null) => {
      // The error will be propagated through the streams
    },
  )
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

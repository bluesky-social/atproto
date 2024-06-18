import { PassThrough, Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { constants, createBrotliCompress, createGzip } from 'node:zlib'

import { Handler, ServerResponse } from './types.js'

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

function negotiateEncoding(accept?: string | string[]) {
  if (accept?.includes('br')) return 'br'
  if (accept?.includes('gzip')) return 'gzip'
  return 'identity'
}

function getEncoder(encoding: string): Transform {
  switch (encoding) {
    case 'br':
      return createBrotliCompress({
        // Default quality is too slow
        params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
      })
    case 'gzip':
      return createGzip()
    case 'identity':
      return new PassThrough()
    default:
      throw new Error(`Unsupported encoding: ${encoding}`)
  }
}

const ifString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

export async function writeStream(
  res: ServerResponse,
  stream: Readable,
  contentType = ifString((stream as any).headers?.['content-type']) ||
    'application/octet-stream',
  status = 200,
): Promise<void> {
  res.statusCode = status
  res.setHeader('content-type', contentType)
  appendHeader(res, 'vary', 'accept-encoding')

  const encoding = negotiateEncoding(res.req.headers['accept-encoding'])

  res.setHeader('content-encoding', encoding)
  res.setHeader('transfer-encoding', 'chunked')

  if (res.req.method === 'HEAD') {
    res.end()
    stream.destroy()
    return
  }

  try {
    await pipeline(stream, getEncoder(encoding), res)
  } catch (err) {
    // Prevent the socket from being left open in a bad state
    res.socket?.destroy()

    if (err != null && typeof err === 'object') {
      // If an abort signal is used, we can consider this function's job successful
      if ('name' in err && err.name === 'AbortError') return

      // If the client closes the connection, we don't care about the error
      if ('code' in err && err.code === 'ERR_STREAM_PREMATURE_CLOSE') return
    }

    throw err
  }
}

export async function writeBuffer(
  res: ServerResponse,
  buffer: Buffer,
  contentType?: string,
  status = 200,
): Promise<void> {
  const stream = Readable.from([buffer])
  return writeStream(res, stream, contentType, status)
}

export async function writeJson(
  res: ServerResponse,
  payload: unknown,
  status = 200,
  contentType = 'application/json',
): Promise<void> {
  const buffer = Buffer.from(JSON.stringify(payload))
  return writeBuffer(res, buffer, contentType, status)
}

export function staticJsonHandler(
  value: unknown,
  contentType = 'application/json',
  status = 200,
): Handler<unknown> {
  const buffer = Buffer.from(JSON.stringify(value))
  return function (req, res, next) {
    void writeBuffer(res, buffer, contentType, status).catch(next)
  }
}

export async function writeHtml(
  res: ServerResponse,
  html: Buffer | string,
  status = 200,
  contentType = 'text/html',
): Promise<void> {
  const buffer = Buffer.isBuffer(html) ? html : Buffer.from(html)
  return writeBuffer(res, buffer, contentType, status)
}

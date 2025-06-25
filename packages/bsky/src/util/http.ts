import { IncomingMessage, ServerResponse } from 'node:http'
import createHttpError from 'http-errors'
import { IncomingHttpHeaders } from 'undici/types/header'

type NextFunction = (err?: unknown) => void

export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void

export type ResponseData = { statusCode: number; headers: IncomingHttpHeaders }

const RESPONSE_HEADERS_TO_PROXY = new Set([
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'cache-control',
  'last-modified',
  'etag',
  'expires',
  'retry-after',
  'vary', // Might vary based on "accept" headers
] as const satisfies (keyof IncomingHttpHeaders)[])

export function proxyResponseHeaders(data: ResponseData, res: ServerResponse) {
  res.statusCode = data.statusCode >= 500 ? 502 : data.statusCode
  for (const name of RESPONSE_HEADERS_TO_PROXY) {
    const val = data.headers[name]
    if (val) res.setHeader(name, val)
  }
}

export function responseSignal(res: ServerResponse): AbortSignal {
  if (res.destroyed) throw createHttpError(499, 'Client Disconnected')
  const controller = new AbortController()
  res.once('close', () => controller.abort())
  return controller.signal
}

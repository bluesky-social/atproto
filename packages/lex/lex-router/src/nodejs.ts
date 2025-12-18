import { once } from 'node:events'
import {
  IncomingHttpHeaders,
  IncomingMessage,
  RequestListener,
  Server as HttpServer,
  ServerResponse,
  createServer as createHttpServer,
} from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export type { HttpServer }

const kNativeRequest = Symbol.for('incomingMessage')

export function getNativeRequest<T extends IncomingMessage>(req: Request): T {
  if (kNativeRequest in req) return req[kNativeRequest] as T
  throw new TypeError('No native IncomingMessage associated with Request')
}

export async function sendResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status
  res.statusMessage = response.statusText

  for (const [key, value] of response.headers) {
    res.appendHeader(key, value)
  }

  if (response.body) {
    await pipeline(Readable.fromWeb(response.body as any), res)
  } else {
    res.end()
  }
}

export function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost'
  const protocol = (req.socket as any).encrypted ? 'https' : 'http'
  const url = new URL(req.url ?? '/', `${protocol}://${host}`)

  const request = new Request(url, {
    method: req.method,
    headers: toHeaders(req.headers),
    body:
      req.method === 'GET' || req.method === 'HEAD'
        ? null
        : (Readable.toWeb(req) as ReadableStream<Uint8Array>),
    // @ts-expect-error
    duplex: 'half',
  })

  // Attach the original NativeRequest for access to Node.js-specific properties
  Object.defineProperty(request, kNativeRequest, {
    value: req,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return request
}

export function toHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) result.append(key, v)
    } else {
      result.set(key, value)
    }
  }
  return result
}

export type Handler = (req: Request) => Promise<Response>
async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  handler: Handler,
) {
  const request = toRequest(req)
  const response = await handler(request)
  await sendResponse(res, response)
}

export function toRequestListener<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(handler: Handler, onError?: (err: unknown) => void) {
  return ((
    req: InstanceType<Request>,
    res: InstanceType<Response> & { req: InstanceType<Request> },
    next?: (err?: unknown) => void,
  ): void => {
    handle(req, res, handler).catch((err) => {
      if (next) next(err)
      else {
        onError?.(err)
        res.statusCode = 500
        res.statusMessage = 'Internal Server Error'
        res.end('Internal Server Error')
      }
    })
  }) satisfies RequestListener<Request, Response>
}

export function createServer(handler: Handler): HttpServer {
  return createHttpServer(toRequestListener(handler))
}

export async function start(
  handler: Handler,
  port: number = 0,
): Promise<HttpServer> {
  // @TODO add proper termination handler
  const server = createServer(handler)
  server.listen(port)
  await once(server, 'listening')
  return server
}

import { once } from 'node:events'
import {
  IncomingHttpHeaders,
  IncomingMessage,
  RequestListener,
  Server as HttpServer,
  ServerOptions,
  ServerResponse,
  createServer as createHttpServer,
} from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHttpTerminator } from 'http-terminator'

const kIncomingMessage = Symbol.for('incomingMessage')

export function getServerResponse<T extends ServerResponse>(req: Request): T {
  if (kIncomingMessage in req) return (req as any)[kIncomingMessage] as T
  throw new TypeError('No native ServerResponse associated with Response')
}

export function getIncomingMessage<T extends IncomingMessage>(req: Request): T {
  const res = getServerResponse(req)
  return res.req as T
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

  return new Request(url, {
    method: req.method,
    headers: toHeaders(req.headers),
    body:
      req.method === 'GET' || req.method === 'HEAD'
        ? null
        : (Readable.toWeb(req) as ReadableStream<Uint8Array>),
    // @ts-expect-error
    duplex: 'half',
  })
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

export type Fetch = (req: Request) => Promise<Response>
export type FetchObject = { fetch: Fetch }

async function handle(req: IncomingMessage, res: ServerResponse, fetch: Fetch) {
  const request = toRequest(req)

  // Attach the original NativeRequest for access to Node.js-specific properties
  Object.defineProperty(request, kIncomingMessage, {
    value: res,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  const response = await fetch(request)
  await sendResponse(res, response)
}

export function toRequestListener<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(fetch: Fetch | FetchObject, onError?: (err: unknown) => void) {
  if (typeof fetch === 'object') fetch = fetch.fetch.bind(fetch)
  return ((
    req: InstanceType<Request>,
    res: InstanceType<Response> & { req: InstanceType<Request> },
    next?: (err?: unknown) => void,
  ): void => {
    handle(req, res, fetch).catch((err) => {
      if (next) next(err)
      else {
        onError?.(err)
        if (!res.headersSent) {
          res.statusCode = 500
          res.statusMessage = 'Internal Server Error'
          res.end('Internal Server Error')
        } else if (!res.writableEnded) {
          res.end()
        }
      }
    })
  }) satisfies RequestListener<Request, Response>
}

export type CreateServerOptions<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
> = ServerOptions<Request, Response> & {
  gracefulTerminationTimeout?: number
}

export interface Server<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
> extends HttpServer<Request, Response> {
  shutdown(): Promise<void>
}

export function createServer<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(
  fetch: Fetch | FetchObject,
  options: CreateServerOptions<Request, Response> = {},
): Server<Request, Response> {
  const server = createHttpServer(options, toRequestListener(fetch))
  const terminator = createHttpTerminator({
    server: server as HttpServer,
    gracefulTerminationTimeout: options?.gracefulTerminationTimeout,
  })

  return Object.defineProperty(server, 'shutdown', {
    value: async function shutdown() {
      if (this === server) await terminator.terminate()
      else throw new TypeError('Server.shutdown called with incorrect context')
    },
    enumerable: false,
    configurable: false,
    writable: false,
  }) as Server<Request, Response>
}

export type StartServerOptions<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
> = CreateServerOptions<Request, Response> & {
  port?: number
}

export async function startServer<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(
  fetch: Fetch | FetchObject,
  options?: StartServerOptions<Request, Response>,
): Promise<Server<Request, Response>> {
  const server = createServer(fetch, options)
  server.listen(options?.port ?? 0)
  await once(server, 'listening')
  return server
}

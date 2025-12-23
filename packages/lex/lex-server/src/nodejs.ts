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
import { ListenOptions } from 'node:net'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHttpTerminator } from 'http-terminator'
import { WebSocket as WebSocketPonyfill, WebSocketServer } from 'ws'

const kIncomingMessage = Symbol.for('incomingMessage')

export function getServerResponse<T extends ServerResponse>(req: Request): T {
  if (kIncomingMessage in req) return (req as any)[kIncomingMessage] as T
  throw new TypeError('No native ServerResponse associated with Response')
}

export function getIncomingMessage<T extends IncomingMessage>(req: Request): T {
  const res = getServerResponse(req)
  return res.req as T
}

const kRequestSocket = Symbol.for('ws:request')

function getRequestSocket(req: IncomingMessage): WebSocketPonyfill {
  if (kRequestSocket in req) {
    return (req as any)[kRequestSocket] as WebSocketPonyfill
  }
  throw new TypeError(
    'Returning a 101 Response is requires using upgradeWebSocket()',
  )
}

export function upgradeWebSocket(request: Request): {
  response: Response
  socket: WebSocket
} {
  if (
    request.method !== 'GET' ||
    request.headers.get('upgrade') !== 'websocket'
  ) {
    throw new TypeError('WebSocket upgrade request must use GET method')
  }

  const req = getIncomingMessage(request)

  // @ts-expect-error
  const socket: WebSocket = new WebSocketPonyfill(null, undefined, {
    autoPong: true,
  })

  Object.defineProperty(req, kRequestSocket, {
    value: socket,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  // Placeholder response for WebSocket upgrade. The actual handling will happen
  // through the handleWebSocketUpgrade function. Headers set on the response
  // will be applied during the upgrade.
  const response = new Response(null, { status: 200 })

  // The Response constructor does not allow setting status 101, so we
  // define it directly. The purpose of this response is just to signal
  // that an upgrade is needed, and to carry any headers.
  Object.defineProperty(response, 'status', {
    value: 101,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return { response, socket }
}

function handleWebSocketUpgrade(res: ServerResponse, response: Response): void {
  const { req } = res

  const socket = getRequestSocket(req)

  const wss = new WebSocketServer({
    autoPong: true,
    noServer: true,
    // @ts-expect-error
    WebSocket: function () {
      // Return the websocket that was created earlier instead of a new instance
      return socket
    },
  })

  // Apply headers that might have been set on the response object during
  // handling. This will be called during wss.handleUpgrade().
  wss.on('headers', (headers) => {
    for (const [name, value] of response.headers) {
      headers.push(`${name}: ${value}`)
    }
  })

  let ws: WebSocketPonyfill | undefined
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (upgradedWs) => {
    ws = upgradedWs
  })

  if (!ws || ws !== socket) {
    ws?.close()
    throw new Error('WebSocket upgrade failed')
  }

  // The request handling now happens through the socket exclusively
}

export async function sendResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  // Request was handled by something else
  if (res.headersSent) return

  if (response.status === 101) {
    return handleWebSocketUpgrade(res, response)
  }

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

  const abortController = new AbortController()
  const abort = () => abortController.abort()

  req.socket.on('error', abort)
  req.socket.on('close', abort)

  abortController.signal.addEventListener(
    'abort',
    () => {
      req.socket.off('error', abort)
      req.socket.off('close', abort)
    },
    { once: true },
  )

  return new Request(url, {
    signal: abortController.signal,
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
>(fetch: Fetch | FetchObject) {
  if (typeof fetch === 'object') fetch = fetch.fetch.bind(fetch)
  return ((
    req: InstanceType<Request>,
    res: InstanceType<Response> & { req: InstanceType<Request> },
    next?: (err?: unknown) => void,
  ): void => {
    handle(req, res, fetch).catch((err) => {
      if (next) next(err)
      else {
        if (!res.headersSent) {
          res.statusCode = 500
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
> = ListenOptions & CreateServerOptions<Request, Response>

export async function serve<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(
  fetch: Fetch | FetchObject,
  options?: StartServerOptions<Request, Response>,
): Promise<Server<Request, Response>> {
  const server = createServer(fetch, options)
  server.listen(options)
  await once(server, 'listening')
  return server
}

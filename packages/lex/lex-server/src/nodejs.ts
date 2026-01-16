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
import { FetchHandler } from './lex-server.js'

// @ts-expect-error
Symbol.asyncDispose ??= Symbol.for('Symbol.asyncDispose')

const kResponseWs = Symbol.for('@atproto/lex-server:WebSocket')

function isUpgradeRequest(request: Request, upgrade: string): boolean {
  return (
    request.method === 'GET' &&
    request.headers.get('connection')?.toLowerCase() === 'upgrade' &&
    request.headers.get('upgrade')?.toLowerCase() === upgrade
  )
}

export function upgradeWebSocket(request: Request): {
  response: Response
  socket: WebSocket
} {
  if (!isUpgradeRequest(request, 'websocket')) {
    throw new TypeError('upgradeWebSocket() expects a WebSocket upgrade')
  }

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

  // @ts-expect-error
  const socket: WebSocket = new WebSocketPonyfill(null, undefined, {
    autoPong: true,
  })

  // Attach the WebSocket to the response for later retrieval
  Object.defineProperty(response, kResponseWs, {
    value: socket,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return { response, socket }
}

const kUpgradeEvent = Symbol.for('@atproto/lex-server:upgrade')

function handleWebSocketUpgrade(
  req: IncomingMessage,
  response: Response,
): void {
  const ws = (response as { [kResponseWs]?: WebSocketPonyfill })[kResponseWs]
  if (!ws) throw new TypeError('Response not created by upgradeWebSocket()')

  // Create a one time use WebSocketServer to handle the upgrade
  const wss = new WebSocketServer({
    autoPong: true,
    noServer: true,
    clientTracking: false,
    perMessageDeflate: true,
    // @ts-expect-error
    WebSocket: function () {
      // Return the websocket that was created earlier instead of a new instance
      return ws
    },
  })

  // Apply headers that might have been set on the response object during
  // handling. This will be called during wss.handleUpgrade().
  wss.on('headers', (headers) => {
    for (const [name, value] of response.headers) {
      headers.push(`${name}: ${value}`)
    }
  })

  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (_socket) => {
    // @TODO find a way to properly "close" the _socket when the server is
    // shutting down (might require replacing http-terminator with a local
    // implementation)

    req.emit(kUpgradeEvent, ws)
  })
}

async function sendResponse(
  req: IncomingMessage,
  res: ServerResponse,
  response: Response,
): Promise<void> {
  // Invalid usage
  if (res.headersSent) {
    throw new TypeError('Response has already been sent')
  }

  if (response.status === 101) {
    return handleWebSocketUpgrade(req, response)
  }

  res.statusCode = response.status
  res.statusMessage = response.statusText

  for (const [key, value] of response.headers) {
    res.appendHeader(key, value)
  }

  if (response.body != null && req.method !== 'HEAD') {
    const stream = Readable.fromWeb(response.body as any)
    await pipeline(stream, res)
  } else {
    await response.body?.cancel()
    res.end()
  }
}

function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? req.socket?.localAddress ?? 'localhost'
  const isEncrypted = (req.socket as any).encrypted === true
  const protocol = isEncrypted ? 'https' : 'http'
  const url = new URL(req.url ?? '/', `${protocol}://${host}`)
  const headers = toHeaders(req.headers)
  const body = toBody(req)
  const signal = requestSignal(req)

  return new Request(url, {
    signal,
    method: req.method,
    headers,
    body,
    referrer: headers.get('referrer') ?? headers.get('referer') ?? undefined,
    redirect: 'manual',
    // @ts-expect-error
    duplex: body ? 'half' : undefined,
  })
}

function requestSignal(req: IncomingMessage): AbortSignal {
  if (req.destroyed) return AbortSignal.abort()

  const abortController = new AbortController()

  const abort = (err?: Error | WebSocket) => {
    abortController.abort(err instanceof Error ? err : undefined)

    req.off('close', abort)
    req.off('error', abort)
    req.off('end', abort)
    req.off(kUpgradeEvent, abort)
  }

  req.on('close', abort)
  req.on('error', abort)
  req.on('end', abort)
  req.on(kUpgradeEvent, abort)

  return abortController.signal
}

function requestCompletion(req: IncomingMessage): Promise<void> {
  if (req.destroyed) return Promise.resolve()

  // Unlike the abort signal, we complete the promise only when the request
  // is fully done, accounting for websocket upgrade.
  return new Promise((resolve) => {
    const cleanup = () => {
      req.off('close', done)
      req.off('error', done)
      req.off('end', done)
      req.off(kUpgradeEvent, onUpgrade)
    }

    const onUpgrade = (ws: WebSocket) => {
      cleanup()
      ws.addEventListener('close', () => resolve())
    }

    const done = () => {
      resolve()
      cleanup()
    }

    req.on('close', done)
    req.on('error', done)
    req.on('end', done)
    req.on(kUpgradeEvent, onUpgrade)
  })
}

function toHeaders(headers: IncomingHttpHeaders): Headers {
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

function toBody(req: IncomingMessage): null | ReadableStream<Uint8Array> {
  if (
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS'
  ) {
    return null
  }

  if (
    req.headers['content-type'] == null &&
    req.headers['transfer-encoding'] == null &&
    req.headers['content-length'] == null
  ) {
    return null
  }

  return Readable.toWeb(req) as ReadableStream<Uint8Array>
}

export type NetAddr = {
  transport: 'tcp'
  hostname: string
  port: number
}

export type NodeConnectionInfo = {
  completed: Promise<void>
  remoteAddr: NetAddr | undefined
}

export interface HandlerObject {
  fetch: FetchHandler
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  fetchHandler: FetchHandler,
) {
  const request = toRequest(req)
  const info = toConnectionInfo(req)
  const response = await fetchHandler(request, info)
  await sendResponse(req, res, response)
}

function toConnectionInfo(req: IncomingMessage): NodeConnectionInfo {
  const { socket } = req

  return {
    completed: requestCompletion(req),
    remoteAddr:
      socket.remoteAddress != null
        ? {
            transport: 'tcp',
            hostname: socket.remoteAddress,
            port: socket.remotePort!,
          }
        : undefined,
  }
}

export function toRequestListener<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(fetchHandler: FetchHandler) {
  return ((
    req: InstanceType<Request>,
    res: InstanceType<Response> & { req: InstanceType<Request> },
    next?: (err?: unknown) => void,
  ): void => {
    handleRequest(req, res, fetchHandler).catch((err) => {
      if (next) next(err)
      else {
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('content-type', 'text/plain; charset=utf-8')
          res.end('Internal Server Error')
        } else if (!res.writableEnded) {
          res.destroy()
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
> extends HttpServer<Request, Response>,
    AsyncDisposable {
  terminate(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}

export function createServer<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
>(
  handler: FetchHandler | HandlerObject,
  options: CreateServerOptions<Request, Response> = {},
): Server<Request, Response> {
  const fetchHandler =
    typeof handler === 'function' ? handler : handler.fetch.bind(handler)

  const listener = toRequestListener(fetchHandler)
  const server = createHttpServer(options, listener)

  const terminator = createHttpTerminator({
    server: server as HttpServer,
    gracefulTerminationTimeout: options?.gracefulTerminationTimeout,
  })

  const terminate = async function terminate(this: Server<Request, Response>) {
    if (this !== server) {
      throw new TypeError('Server.terminate called with incorrect context')
    }
    // @TODO properly close all active WebSocket connections
    return terminator.terminate()
  }

  Object.defineProperty(server, 'terminate', {
    value: terminate,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  Object.defineProperty(server, Symbol.asyncDispose, {
    value: terminate,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return server as Server<Request, Response>
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
  handler: FetchHandler | HandlerObject,
  options?: StartServerOptions<Request, Response>,
): Promise<Server<Request, Response>> {
  const server = createServer(handler, options)
  server.listen(options)
  await once(server, 'listening')
  return server
}

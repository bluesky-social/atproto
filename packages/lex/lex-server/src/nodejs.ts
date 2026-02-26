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
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
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

/**
 * Upgrades an HTTP request to a WebSocket connection for Node.js.
 *
 * This function must be passed to the {@link LexRouter} constructor to enable
 * subscription (WebSocket) support on Node.js. It creates a WebSocket instance
 * and a placeholder response that signals the need for protocol upgrade.
 *
 * The actual upgrade is handled internally when the response is sent through
 * {@link sendResponse}.
 *
 * @param request - The incoming HTTP request to upgrade
 * @returns An object containing the WebSocket and upgrade response
 * @throws {TypeError} If the request is not a valid WebSocket upgrade request
 *
 * @example
 * ```typescript
 * import { LexRouter } from '@atproto/lex-server'
 * import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
 *
 * // Pass to router for subscription support
 * const router = new LexRouter({ upgradeWebSocket })
 *
 * // Now you can add subscription handlers
 * router.add(subscribeRepos, async function* (ctx) {
 *   for await (const event of eventStream) {
 *     yield event
 *   }
 * })
 * ```
 */
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

/**
 * Sends a fetch API Response through a Node.js ServerResponse.
 *
 * Handles both regular HTTP responses and WebSocket upgrades. For WebSocket
 * upgrades (status 101), delegates to the WebSocket upgrade handler.
 *
 * This function is used internally by {@link toRequestListener} and
 * {@link createServer}, but can be used directly for custom integrations.
 *
 * @param req - The Node.js IncomingMessage
 * @param res - The Node.js ServerResponse to write to
 * @param response - The fetch API Response to send
 * @throws {TypeError} If headers have already been sent
 *
 * @example
 * ```typescript
 * import http from 'node:http'
 * import { sendResponse } from '@atproto/lex-server/nodejs'
 *
 * const server = http.createServer(async (req, res) => {
 *   const response = new Response('Hello, World!', {
 *     headers: { 'Content-Type': 'text/plain' }
 *   })
 *   await sendResponse(req, res, response)
 * })
 * ```
 */
export async function sendResponse(
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
    res.setHeader(key, value)
  }

  if (response.body != null && req.method !== 'HEAD') {
    const stream = Readable.fromWeb(response.body as NodeReadableStream)
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

function toBody(req: IncomingMessage): null | ReadableStream {
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

  return Readable.toWeb(req) as ReadableStream
}

/**
 * Network address type for Node.js TCP connections.
 *
 * @example
 * ```typescript
 * const addr: NetAddr = {
 *   transport: 'tcp',
 *   hostname: '192.168.1.100',
 *   port: 54321
 * }
 * ```
 */
export type NetAddr = {
  /** Always 'tcp' for Node.js HTTP connections. */
  transport: 'tcp'
  /** The IP address of the remote client. */
  hostname: string
  /** The port number of the remote client. */
  port: number
}

/**
 * Connection metadata for Node.js HTTP requests.
 *
 * Provides information about the client connection, including the remote
 * address and a promise that resolves when the connection is fully closed
 * (including WebSocket connections).
 */
export type NodeConnectionInfo = {
  /** Promise that resolves when the connection is fully closed. */
  completed: Promise<void>
  /** The remote address of the client, if available. */
  remoteAddr: NetAddr | undefined
}

/**
 * Interface for objects that can handle fetch-style requests.
 *
 * Used by {@link createServer} and {@link serve} to accept either
 * a fetch handler function or an object with a `fetch` method
 * (like {@link LexRouter}).
 */
export interface HandlerObject {
  /** The fetch handler method. */
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

/**
 * Converts a fetch-style handler to a Node.js request listener.
 *
 * The returned listener can be used with Node.js HTTP servers directly,
 * or as middleware in frameworks like Express (supports the `next` callback).
 *
 * @typeParam Request - The request class type (default: IncomingMessage)
 * @typeParam Response - The response class type (default: ServerResponse)
 * @param fetchHandler - The fetch-style handler function
 * @returns A Node.js RequestListener compatible with http.createServer
 *
 * @example Using as Express middleware
 * ```typescript
 * import express from 'express'
 * import { toRequestListener } from '@atproto/lex-server/nodejs'
 * import { LexRouter } from '@atproto/lex-server'
 *
 * const router = new LexRouter()
 * // Register handlers...
 *
 * const app = express()
 *
 * // Mount the XRPC router
 * app.use('/xrpc', toRequestListener(router.fetch))
 * ```
 */
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

/**
 * Options for creating an XRPC server.
 *
 * Extends Node.js {@link ServerOptions} with additional options for graceful shutdown.
 */
export type CreateServerOptions<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
> = ServerOptions<Request, Response> & {
  /**
   * Timeout in milliseconds for graceful termination.
   *
   * When `terminate()` is called, the server will wait up to this duration
   * for active connections to complete before forcibly closing them.
   */
  gracefulTerminationTimeout?: number
}

/**
 * Extended HTTP server with graceful shutdown support.
 *
 * Extends the standard Node.js HttpServer with a `terminate()` method
 * for graceful shutdown and implements `AsyncDisposable` for use with
 * `await using`.
 *
 * @typeParam Request - The request class type
 * @typeParam Response - The response class type
 *
 * @example Graceful shutdown
 * ```typescript
 * const server = createServer(router)
 * server.listen(3000)
 *
 * process.on('SIGTERM', async () => {
 *   console.log('Shutting down...')
 *   await server.terminate()
 *   console.log('Server stopped')
 * })
 * ```
 *
 * @example Using with await using
 * ```typescript
 * await using server = await serve(router, { port: 3000 })
 * // Server will be automatically terminated when scope exits
 * ```
 */
export interface Server<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
> extends HttpServer<Request, Response>,
    AsyncDisposable {
  /**
   * Gracefully terminates the server.
   *
   * Stops accepting new connections and waits for active connections
   * to complete (up to `gracefulTerminationTimeout`).
   *
   * @returns Promise that resolves when the server is fully stopped
   */
  terminate(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}

/**
 * Creates an HTTP server configured for XRPC request handling.
 *
 * The server includes graceful shutdown support and can be used with
 * either a fetch handler function or an object with a `fetch` method
 * (like {@link LexRouter}).
 *
 * Note: This creates the server but does not start listening. Call
 * `server.listen()` to start the server, or use {@link serve} for
 * a combined create-and-listen operation.
 *
 * @typeParam Request - The request class type
 * @typeParam Response - The response class type
 * @param handler - A fetch handler or object with fetch method
 * @param options - Server configuration options
 * @returns An HTTP server with graceful shutdown support
 *
 * @example Basic usage
 * ```typescript
 * import { LexRouter } from '@atproto/lex-server'
 * import { createServer, upgradeWebSocket } from '@atproto/lex-server/nodejs'
 *
 * const router = new LexRouter({ upgradeWebSocket })
 * router.add(myMethod, myHandler)
 *
 * const server = createServer(router)
 * server.listen(3000, () => {
 *   console.log('Server listening on port 3000')
 * })
 * ```
 *
 * @example With graceful termination timeout
 * ```typescript
 * const server = createServer(router, {
 *   gracefulTerminationTimeout: 10000 // 10 seconds
 * })
 * ```
 */
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

/**
 * Combined options for creating and starting an XRPC server.
 *
 * Includes both server creation options and network listen options.
 *
 * @typeParam Request - The request class type
 * @typeParam Response - The response class type
 *
 * @example
 * ```typescript
 * const options: StartServerOptions = {
 *   port: 3000,
 *   host: '0.0.0.0',
 *   gracefulTerminationTimeout: 10000
 * }
 * ```
 */
export type StartServerOptions<
  Request extends typeof IncomingMessage = typeof IncomingMessage,
  Response extends typeof ServerResponse<
    InstanceType<Request>
  > = typeof ServerResponse,
> = ListenOptions & CreateServerOptions<Request, Response>

/**
 * Creates and starts an HTTP server, returning when it's ready to accept connections.
 *
 * This is a convenience function that combines {@link createServer} and `server.listen()`
 * into a single async operation. The returned promise resolves once the server
 * is actively listening.
 *
 * @typeParam Request - The request class type
 * @typeParam Response - The response class type
 * @param handler - A fetch handler or object with fetch method (like {@link LexRouter})
 * @param options - Combined server and listen options
 * @returns Promise resolving to the running server
 *
 * @example Basic usage
 * ```typescript
 * import { LexRouter } from '@atproto/lex-server'
 * import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'
 *
 * const router = new LexRouter({ upgradeWebSocket })
 *
 * // Register handlers
 * router.add(getProfile, async (ctx) => {
 *   return { body: await db.getProfile(ctx.params.actor) }
 * })
 *
 * // Start server on port 3000
 * const server = await serve(router, { port: 3000 })
 * console.log('Server listening on port 3000')
 *
 * // Graceful shutdown
 * process.on('SIGTERM', () => server.terminate())
 * process.on('SIGINT', () => server.terminate())
 * ```
 *
 * @example With all options
 * ```typescript
 * const server = await serve(router, {
 *   port: 3000,
 *   host: '0.0.0.0',
 *   gracefulTerminationTimeout: 15000,
 * })
 * ```
 *
 * @example Using with await using (auto-cleanup)
 * ```typescript
 * async function main() {
 *   await using server = await serve(router, { port: 3000 })
 *
 *   // Server is running...
 *   console.log('Server listening on port 3000')
 *
 *   // Wait for termination signal
 *   await Promise.race([
 *     once(process, 'SIGINT'),
 *     once(process, 'SIGTERM'),
 *   ])
 *
 *   // Server will be automatically terminated when scope exits
 * }
 * ```
 */
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

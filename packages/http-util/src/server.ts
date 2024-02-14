import {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse,
} from 'node:http'
import { Server as HttpsServer } from 'node:https'
import { Socket } from 'node:net'

/**
 * Inspired by {@link https://github.com/thedillonb/http-shutdown/blob/master/index.js}
 */
export function createShutdown(
  server: HttpServer | HttpsServer,
  gracefulTerminationTimeout = 30_000,
) {
  const sockets = new Set<Socket>()
  const idleSockets = new WeakSet<Socket>()

  let terminated = false

  server.on('connection', onConnection)
  server.on('secureConnection', onConnection)
  server.on('request', onRequest)

  /**
   * This function can only be used once. If the server is re-started (using
   * listen()) then a new shutdown function must be created.
   */
  return async () => {
    if (terminated) throw new Error('Server is already terminated')

    terminated = true

    return new Promise<void>((resolve, reject) => {
      // Stop accepting new connections
      server.close((err) => {
        // This callback is called when all existing connections are closed.

        clearTimeout(timer)

        server.off('connection', onConnection)
        server.off('secureConnection', onConnection)
        server.off('request', onRequest)
        server.off('request', onRequestWhenTerminated)

        if (err && (err as any).code !== 'ERR_SERVER_NOT_RUNNING') {
          reject(err)
        } else {
          resolve()
        }
      })

      // If any new request is made on an existing connection, make sure the
      // connection is closed once the request is done.
      server.on('request', onRequestWhenTerminated)

      for (const socket of sockets) {
        // Mark requests that are being processed (but not yet sent) to close
        // the connection once they are done.
        const res = (socket as { _httpMessage?: ServerResponse })._httpMessage
        if (res) setConnectionClose(res)

        // Actively close all idle sockets
        if (idleSockets.has(socket)) {
          destroy(socket)
        }
      }

      // At this point what remains are sockets linked to requests that are
      // being processed. They should be closed once the 'finish' event is
      // emitted, or when the timeout is reached.

      const timer = setTimeout(() => {
        for (const socket of sockets) {
          destroy(socket)
        }
      }, gracefulTerminationTimeout).unref()
    })
  }

  function destroy(socket: Socket) {
    socket.destroy()
    sockets.delete(socket)
    idleSockets.delete(socket)
  }

  function onConnection(socket: Socket) {
    idleSockets.add(socket)
    sockets.add(socket)

    socket.once('close', onSocketClose)
  }

  function onSocketClose(this: Socket) {
    sockets.delete(this)
    idleSockets.delete(this)
  }

  function onRequest(req: IncomingMessage, res: ServerResponse) {
    idleSockets.delete(req.socket)

    res.once('finish', onResponseFinished)
  }

  function onResponseFinished(this: ServerResponse) {
    const { req } = this
    idleSockets.add(req.socket)

    // If the server is terminated, but the user agent sent several requests
    // on the same connection, we want to allow these requests to be processed
    // before closing the connection.
    if (terminated) {
      // We allow a full event loop cycle to run before we check if the
      // connection contained any other requests. "setTimeout" brings us to the
      // beginning of the next event loop cycle.
      setTimeout(() => {
        // "setImmediate" brings us after I/O callbacks are processed.
        setImmediate(() => {
          if (idleSockets.has(req.socket)) destroy(req.socket)
        }).unref()
      }).unref()
    }
  }

  function onRequestWhenTerminated(req: IncomingMessage, res: ServerResponse) {
    setConnectionClose(res)
  }

  function setConnectionClose(res: ServerResponse) {
    if (!res.headersSent) {
      res.setHeader('connection', 'close')
    }
  }
}

export async function startServer<S extends HttpServer | HttpsServer>(
  signal: AbortSignal,
  server: S,
  ...args: Parameters<S['listen']>
) {
  if (signal.aborted) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    server.listen(...args)

    const shutdown = createShutdown(server)

    server.on('listening', onListening)
    server.on('error', onError)

    signal.addEventListener('abort', shutdownAndResolve)

    function onListening(this: S) {
      server.off('listening', onListening)
      server.off('error', onError)
      logServerAddress.call(this)
    }

    function onError(this: S, err: Error) {
      signal.removeEventListener('abort', shutdownAndResolve)

      server.off('listening', onListening)
      server.off('error', onError)

      // We call shutdown() even though the server was never listening because
      // we want to cleanup any resources that were allocated.
      shutdown().then(
        () => reject(err),
        () => reject(err), // ignore shutdown error if there was a listen error
      )
    }

    function shutdownAndResolve() {
      signal.removeEventListener('abort', shutdownAndResolve)
      server.off('listening', onListening)
      server.off('error', onError)

      shutdown().then(resolve, reject)
    }
  })
}

export function logServerAddress(this: HttpServer | HttpsServer) {
  const info = this.address()
  if (info) {
    const protocol = this instanceof HttpServer ? 'http' : 'https'
    if (typeof info === 'string') {
      console.log(`${protocol} server listening on ${info}`)
    } else {
      const host = info.family === 'IPv4' ? info.address : `[${info.address}]`
      console.log(`server listening on ${protocol}://${host}:${info.port}`)
    }
  }
}

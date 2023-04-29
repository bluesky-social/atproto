import { IncomingMessage } from 'http'
import { WebSocketServer, ServerOptions, WebSocket } from 'ws'
import { ErrorFrame, Frame } from './frames'
import logger from './logger'
import { CloseCode, DisconnectError } from './types'

export class XrpcStreamServer {
  wss: WebSocketServer
  constructor(opts: ServerOptions & { handler: Handler }) {
    const { handler, ...serverOpts } = opts
    this.wss = new WebSocketServer(serverOpts)
    this.wss.on('connection', async (socket, req) => {
      socket.on('error', (err) => logger.error(err, 'websocket error'))
      try {
        const ac = new AbortController()
        const iterator = unwrapIterator(handler(req, ac.signal, socket, this))
        socket.once('close', () => {
          iterator.return?.()
          ac.abort()
        })
        const safeFrames = wrapIterator(iterator)
        for await (const frame of safeFrames) {
          await new Promise((res, rej) => {
            socket.send(frame.toBytes(), { binary: true }, (err) => {
              // @TODO this callback may give more aggressive on backpressure than
              // we ultimately want, but trying it out for the time being.
              if (err) return rej(err)
              res(undefined)
            })
          })
          if (frame instanceof ErrorFrame) {
            throw new DisconnectError(CloseCode.Policy, frame.body.error)
          }
        }
      } catch (err) {
        if (err instanceof DisconnectError) {
          return socket.close(err.wsCode, err.xrpcCode)
        } else {
          logger.error(err, 'websocket server error')
          return socket.terminate()
        }
      }
      socket.close(CloseCode.Normal)
    })
  }
}

export type Handler = (
  req: IncomingMessage,
  signal: AbortSignal,
  socket: WebSocket,
  server: XrpcStreamServer,
) => AsyncIterable<Frame>

function unwrapIterator<T>(iterable: AsyncIterable<T>): AsyncIterator<T> {
  return iterable[Symbol.asyncIterator]()
}

function wrapIterator<T>(iterator: AsyncIterator<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      return iterator
    },
  }
}

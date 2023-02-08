import { IncomingMessage } from 'http'
import { WebSocketServer, ServerOptions, WebSocket } from 'ws'
import { ErrorFrame, Frame } from './frames'
import logger from './logger'

export class XrpcStreamServer {
  wss: WebSocketServer
  constructor(opts: ServerOptions & { handler: Handler }) {
    const { handler, ...serverOpts } = opts
    this.wss = new WebSocketServer(serverOpts)
    this.wss.on('connection', async (socket, req) => {
      socket.on('error', (err) => logger.error(err, 'websocket error'))
      try {
        const iterator = unwrapIterator(handler(req, socket, this))
        socket.once('close', () => iterator.return?.())
        const safeFrames = wrapIterator(iterator)
        for await (const frame of safeFrames) {
          if (frame instanceof ErrorFrame) {
            await new Promise((res, rej) => {
              socket.send(frame.toBytes(), { binary: true }, (err) => {
                if (err) return rej(err)
                res(undefined)
              })
            })
            throw new DisconnectError(CloseCode.Policy, frame.body.error)
          } else {
            socket.send(frame.toBytes(), { binary: true })
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
  socket: WebSocket,
  server: XrpcStreamServer,
) => AsyncIterable<Frame>

export class DisconnectError extends Error {
  constructor(
    public wsCode: CloseCode = CloseCode.Policy,
    public xrpcCode?: string,
  ) {
    super()
  }
}

// https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
export enum CloseCode {
  Normal = 1000,
  Policy = 1008,
}

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

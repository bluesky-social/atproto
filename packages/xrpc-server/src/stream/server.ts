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
        for await (const frame of handler(req, socket, this)) {
          if (frame instanceof ErrorFrame) {
            await new Promise((res, rej) => {
              socket.send(frame.toBytes(), { binary: true }, (err) => {
                if (err) return rej(err)
                res(undefined)
              })
            })
            throw new DisconnectError()
          } else {
            socket.send(frame.toBytes(), { binary: true })
          }
        }
      } catch (err) {
        if (err instanceof DisconnectError) {
          return socket.close(err.code ?? CloseCode.Policy)
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
  constructor(public code?: CloseCode) {
    super()
  }
}

// https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
export enum CloseCode {
  Normal = 1000,
  Policy = 1008,
}

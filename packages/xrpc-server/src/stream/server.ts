import { IncomingMessage } from 'node:http'
import {
  WebSocketServer,
  ServerOptions,
  WebSocket,
  createWebSocketStream,
} from 'ws'
import { ErrorFrame, Frame } from './frames'
import logger from './logger'
import { CloseCode, DisconnectError } from './types'
import { pipeline } from 'node:stream/promises'

export class XrpcStreamServer {
  wss: WebSocketServer
  constructor(opts: ServerOptions & { handler: Handler }) {
    const { handler, ...serverOpts } = opts

    this.wss = new WebSocketServer(serverOpts)
    this.wss.on('connection', async (ws, req) => {
      // Needed because async generators get their own context
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const server = this

      try {
        await pipeline(
          async function* () {
            const ac = new AbortController()
            try {
              for await (const frame of handler(req, ac.signal, ws, server)) {
                yield frame.toBytes()

                if (frame instanceof ErrorFrame) {
                  throw new DisconnectError(CloseCode.Policy, frame.body.error)
                }
              }
            } catch (err) {
              if (err instanceof DisconnectError) {
                ws.close(err.wsCode, err.xrpcCode)
                return
              } else {
                logger.error(err, 'websocket server error')
                return
              }
            } finally {
              // Make sure the signal is aborted when the async iterable is
              // returned() or throw()s because the client is closed. This
              // behavior is redundant with "return()" and "throw()" from the
              // iterable, but allows simpler DX for the handler.
              ac.abort()
              ws.close(CloseCode.Normal)
            }
          },
          createWebSocketStream(ws),
          async function (readable) {
            for await (const _ of readable) {
              // ignore incoming data
              // @TODO: Should we throw here (resulting in an error), to avoid abuse ?
            }
          },
        )
      } catch (err) {
        logger.error(err, 'websocket error')
      }
    })
  }
}

export type Handler = (
  req: IncomingMessage,
  signal: AbortSignal,
  socket: WebSocket,
  server: XrpcStreamServer,
) => AsyncIterable<Frame>

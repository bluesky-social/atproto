import { IncomingMessage } from 'node:http'
import { Duplex } from 'node:stream'
import { WebSocketServer, ServerOptions, WebSocket } from 'ws'
import { ErrorFrame, Frame } from './frames'
import logger from './logger'
import { CloseCode, DisconnectError } from './types'

export class XrpcStreamServer {
  wss: WebSocketServer
  constructor(opts: ServerOptions & { handler: Handler }) {
    const { handler, ...serverOpts } = opts
    this.wss = new WebSocketServer(serverOpts)
    this.wss.on('connection', async (ws, req) => {
      ws.on('error', (err) => logger.error(err, 'websocket error'))
      try {
        const ac = new AbortController()
        const iterable = handler(req, ac.signal, ws, this)
        const duplex =
          '_socket' in ws && ws._socket instanceof Duplex ? ws._socket : null

        const iterator = unwrapIterator(iterable)
        ws.once('close', () => {
          iterator.return?.()
          ac.abort()
        })
        ws.on('message', (_data, _isBinary) => {
          // ignore messages
          // @TODO: Should we close the socket here, to avoid abuse ?
        })

        const safeFrames = wrapIterator(iterator)
        for await (const frame of safeFrames) {
          await new Promise<void>((res, rej) => {
            ws.send(frame.toBytes(), { binary: true }, (err) => {
              if (err) return rej(err)

              // If the sender buffer is full, we need to wait for the drain event
              if (duplex?.writableNeedDrain) {
                // @TODO: Should we setup a termination timeout here ?
                duplex.once('drain', res)
              } else {
                res()
              }
            })
          })

          if (frame instanceof ErrorFrame) {
            throw new DisconnectError(CloseCode.Policy, frame.body.error)
          }
        }
      } catch (err) {
        if (err instanceof DisconnectError) {
          return ws.close(err.wsCode, err.xrpcCode)
        } else {
          logger.error(err, 'websocket server error')
          return ws.terminate()
        }
      }
      ws.close(CloseCode.Normal)
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

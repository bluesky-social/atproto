import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { ServerOptions, WebSocketServer } from 'ws'
import { ErrorFrame, Frame } from './frames'
import logger from './logger'
import { CloseCode } from './types'

const HIGH_WATER_MARK = 16384
const LOW_WATER_MARK = 4096

export class XrpcStreamServer {
  wss: WebSocketServer
  constructor({ handler, ...opts }: ServerOptions & { handler: Handler }) {
    this.wss = new WebSocketServer(opts)
    this.wss.on('connection', async (ws, req) => {
      const ac = new AbortController()
      const readable = Readable.from(handler(req, ac.signal), {
        // The data will be buffered in the websocket's underlying socket (the
        // actual HTTP connection). When that buffer is full, and the readable
        // is paused, we don't want the readable to start buffering data, so we
        // set a low water mark here.
        highWaterMark: 1,
      })

      const abortHandler = () => {
        // abort the handler's signal
        ac.abort()
        // "return" the iterator
        readable.destroy()
      }

      ws.once('close', () => {
        abortHandler()
      })

      ws.once('error', (err) => {
        logger.error(err, 'websocket error')
        abortHandler()
      })

      readable.on('data', function (frame: Frame) {
        if (frame instanceof ErrorFrame) {
          ws.close(CloseCode.Policy, frame.code)
          return
        }

        ws.send(frame.toBytes(), function (err) {
          if (err) {
            logger.error(err, 'websocket error')
            abortHandler()
            return
          }

          if (ws.bufferedAmount <= LOW_WATER_MARK && readable.isPaused()) {
            readable.resume()
          }
        })

        if (ws.bufferedAmount >= HIGH_WATER_MARK && !readable.isPaused()) {
          readable.pause()
        }
      })

      readable.once('end', () => {
        ws.close(CloseCode.Normal)
      })

      readable.once('error', (err) => {
        logger.error(err, 'websocket server error')
        ws.terminate()
      })
    })
  }
}

export type Handler = (
  req: IncomingMessage,
  signal: AbortSignal,
) => AsyncIterable<Frame>

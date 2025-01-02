import assert from 'node:assert'
import { IncomingMessage } from 'node:http'
import { ServerOptions, WebSocket, WebSocketServer } from 'ws'
import { ErrorFrame, Frame } from './frames'
import logger from './logger'
import { CloseCode } from './types'

export type XrpcStreamServerOptions = {
  handler: Handler
  highWaterMark?: number
  lowWaterMark?: number
} & ServerOptions

export class XrpcStreamServer {
  wss: WebSocketServer
  constructor({
    handler,
    highWaterMark = 16384,
    lowWaterMark = 4096,
    ...opts
  }: XrpcStreamServerOptions) {
    this.wss = new WebSocketServer(opts)
    this.wss.on('connection', (ws, req) => {
      const ac = new AbortController()

      const iterable = handler(req, ac.signal, ws, this)
      const iterator = iterable[Symbol.asyncIterator]()

      const abortHandler = () => {
        if (!ac.signal.aborted) {
          ac.abort()
          iterator.return?.()
        }
      }

      // Inbound messages are not expected
      ws.on('message', (_data, _isBinary) => {
        // @TODO should we cause an error here (to avoid clients from consuming
        // un-necessary bandwidth) ?
      })

      ws.once('close', () => {
        abortHandler()
      })

      ws.once('error', (err) => {
        logger.error(err, 'websocket error')
        abortHandler()
      })

      let paused = false
      let pending = 0

      let done = false

      const close = (...args: Parameters<typeof ws.close>): void => {
        if (
          ws.readyState !== WebSocket.CLOSING &&
          ws.readyState !== WebSocket.CLOSED
        ) {
          ws.close(...args)
        }
      }

      const readNext = () => {
        iterator.next().then(
          (result) => {
            assert(!done, 'should not read after done')
            assert(!paused, 'should not read while paused')

            if (result.done) {
              done = true

              // This should not be needed since the iterator ended. Let's make
              // sure we don't leak.
              ac.abort()

              // Only close now if no items are pending. Otherwise, we'll close
              // after the last item is sent (see send() callback).
              if (pending === 0) close(CloseCode.Normal)

              return
            }

            const frame = result.value

            pending++

            ws.send(frame.toBytes(), { binary: true }, (err) => {
              pending--

              if (err) {
                abortHandler()
                ws.terminate() // Just to be sure
                logger.error(err, 'websocket error')
                return
              }

              if (done) {
                // If this is the last callback, we can close now
                if (pending === 0) {
                  if (frame instanceof ErrorFrame) {
                    close(CloseCode.Policy, frame.code)
                  } else {
                    close(CloseCode.Normal)
                  }
                }
                return
              }

              if (paused && ws.bufferedAmount <= lowWaterMark) {
                // resume
                paused = false
                readNext()
              }
            })

            if (frame instanceof ErrorFrame) {
              // Make sure we stop consuming
              done = true
              abortHandler()
            } else if (ws.bufferedAmount >= highWaterMark) {
              // pause
              paused = true
            } else {
              readNext()
            }
          },
          (err) => {
            logger.error(err, 'websocket server error')
            abortHandler()
            ws.terminate()
          },
        )
      }

      readNext()
    })
  }
}

export type Handler = (
  req: IncomingMessage,
  signal: AbortSignal,
  socket: WebSocket,
  server: XrpcStreamServer,
) => AsyncIterable<Frame>

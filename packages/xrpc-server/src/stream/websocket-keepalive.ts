import { SECOND, wait } from '@atproto/common'
import { WebSocket, ClientOptions } from 'ws'
import { streamByteChunks } from './stream'
import { CloseCode, DisconnectError } from './types'

export class WebSocketKeepAlive implements AsyncIterable<Uint8Array> {
  constructor(
    public opts: ClientOptions & {
      getUrl: () => Promise<string>
      maxReconnectSeconds?: number
      signal?: AbortSignal
      heartbeatIntervalMs?: number
      onReconnectError?: (
        error: unknown,
        n: number,
        initialSetup: boolean,
      ) => void
    },
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
    const maxReconnectMs = 1000 * (this.opts.maxReconnectSeconds ?? 64)

    let initialSetup = true
    let reconnects: number | null = null

    while (this.opts.signal?.aborted !== true) {
      if (reconnects !== null) {
        const duration = initialSetup
          ? Math.min(1000, maxReconnectMs)
          : backoffMs(reconnects++, maxReconnectMs)
        await wait(duration)

        if (this.opts.signal?.aborted) break
      }
      const url = await this.opts.getUrl()

      if (this.opts.signal?.aborted) break

      const ac = new AbortController()
      const ws = new WebSocket(url, this.opts)

      try {
        this.opts.signal?.addEventListener(
          'abort',
          (event) => ac.abort((event.target as AbortSignal).reason),
          // @ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68625
          { signal: ac.signal },
        )

        ws.once('open', () => {
          initialSetup = false
          reconnects = 0
          if (!ac.signal.aborted) {
            this.startHeartbeat(ws)
          }
        })

        ws.once('close', (code, reason) => {
          if (code === CloseCode.Abnormal) {
            // Forward into an error to distinguish from a clean close
            ac.abort(
              new AbnormalCloseError(`Abnormal ws close: ${reason.toString()}`),
            )
          }
        })

        const wsStream = streamByteChunks(ws, { signal: ac.signal })
        for await (const chunk of wsStream) {
          yield chunk
        }

        // Other side cleanly ended stream and disconnected
        break
      } catch (_err) {
        const err = _err?.['code'] === 'ABORT_ERR' ? _err['cause'] : _err
        if (err instanceof DisconnectError) {
          // We cleanly end the connection
          ws.close(err.wsCode)
          break
        }

        if (isReconnectable(err)) {
          reconnects ??= 0 // Never reconnect with a null
          this.opts.onReconnectError?.(err, reconnects, initialSetup)
          continue
        } else {
          throw err
        }
      } finally {
        // No-ops if already closed or closing
        ws.close()

        // Remove listener on incoming signal
        ac.abort()
      }
    }
  }

  startHeartbeat(ws: WebSocket) {
    let isAlive = true
    let heartbeatInterval: NodeJS.Timeout | null = null

    const checkAlive = () => {
      if (!isAlive) {
        return ws.terminate()
      }
      isAlive = false // expect websocket to no longer be alive unless we receive a "pong" within the interval
      ws.ping()
    }

    checkAlive()
    heartbeatInterval = setInterval(
      checkAlive,
      this.opts.heartbeatIntervalMs ?? 10 * SECOND,
    )

    ws.on('pong', () => {
      isAlive = true
    })
    ws.once('close', () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }
    })
  }
}

export default WebSocketKeepAlive

class AbnormalCloseError extends Error {
  code = 'EWSABNORMALCLOSE'
}

function isReconnectable(err: unknown): boolean {
  // Network errors are reconnectable.
  // AuthenticationRequired and InvalidRequest XRPCErrors are not reconnectable.
  // @TODO method-specific XRPCErrors may be reconnectable, need to consider. Receiving
  // an invalid message is not current reconnectable, but the user can decide to skip them.
  if (!err || typeof err['code'] !== 'string') return false
  return networkErrorCodes.includes(err['code'])
}

const networkErrorCodes = [
  'EWSABNORMALCLOSE',
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ECANCELED',
]

function backoffMs(n: number, maxMs: number) {
  const baseSec = Math.pow(2, n) // 1, 2, 4, ...
  const randSec = Math.random() - 0.5 // Random jitter between -.5 and .5 seconds
  const ms = 1000 * (baseSec + randSec)
  return Math.min(ms, maxMs)
}

import { SECOND, wait } from '@atproto/common'
import { WebSocket, ClientOptions } from 'ws'
import { streamByteChunks } from './stream'
import { CloseCode, DisconnectError } from './types'

export class WebSocketKeepAlive {
  public ws: WebSocket | null = null
  public initialSetup = true
  public reconnects: number | null = null
  public isAlive = false
  public heartbeatInterval: NodeJS.Timer | null

  constructor(
    public opts: ClientOptions & {
      getUrl: () => Promise<string>
      maxReconnectSeconds?: number
      signal?: AbortSignal
      heartbeatInterval?: number
      onReconnectError?: (
        error: unknown,
        n: number,
        initialSetup: boolean,
      ) => void
    },
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
    const maxReconnectMs = 1000 * (this.opts.maxReconnectSeconds ?? 64)
    while (true) {
      if (this.reconnects !== null) {
        const duration = this.initialSetup
          ? Math.min(1000, maxReconnectMs)
          : backoffMs(this.reconnects++, maxReconnectMs)
        await wait(duration)
      }
      const url = await this.opts.getUrl()
      this.ws = new WebSocket(url, this.opts)
      const ac = new AbortController()
      if (this.opts.signal) {
        forwardSignal(this.opts.signal, ac)
      }
      this.ws.once('open', () => {
        this.initialSetup = false
        this.reconnects = 0
        this.startHeartbeat()
      })
      this.ws.once('close', (code, reason) => {
        if (code === CloseCode.Abnormal) {
          // Forward into an error to distinguish from a clean close
          ac.abort(
            new AbnormalCloseError(`Abnormal ws close: ${reason.toString()}`),
          )
        }
        this.clearHeartbeatInterval()
      })

      try {
        const wsStream = streamByteChunks(this.ws, { signal: ac.signal })
        for await (const chunk of wsStream) {
          yield chunk
        }
      } catch (_err) {
        const err = _err?.['code'] === 'ABORT_ERR' ? _err['cause'] : _err
        if (err instanceof DisconnectError) {
          // We cleanly end the connection
          this.ws?.close(err.wsCode)
          break
        }
        this.ws?.close() // No-ops if already closed or closing
        if (isReconnectable(err)) {
          this.reconnects ??= 0 // Never reconnect with a null
          this.opts.onReconnectError?.(err, this.reconnects, this.initialSetup)
          continue
        } else {
          throw err
        }
      }
      break // Other side cleanly ended stream and disconnected
    }
  }

  startHeartbeat() {
    const checkAlive = () => {
      if (!this.isAlive) {
        this.ws?.terminate()
      }
      this.isAlive = false // expect websocket to no longer be alive unless we receive a "pong" within the interval
      this.ws?.ping()
    }

    this.clearHeartbeatInterval() // clean up any previous interval that's stuck around
    this.ws?.on('pong', () => {
      this.isAlive = true
    })

    this.isAlive = true
    checkAlive()
    this.heartbeatInterval = setInterval(
      checkAlive,
      this.opts.heartbeatInterval ?? 10 * SECOND,
    )
  }

  clearHeartbeatInterval() {
    if (this.heartbeatInterval === null) return
    clearInterval(this.heartbeatInterval)
    this.heartbeatInterval = null
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

function forwardSignal(signal: AbortSignal, ac: AbortController) {
  if (signal.aborted) {
    return ac.abort(signal.reason)
  } else {
    signal.addEventListener('abort', () => ac.abort(signal.reason), {
      signal: ac.signal,
    })
  }
}

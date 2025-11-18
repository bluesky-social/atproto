import { ClientOptions, WebSocket, createWebSocketStream } from 'ws'
import { SECOND, isErrnoException, wait } from '@atproto/common'

export class WebSocketKeepAlive {
  public ws: WebSocket | null = null
  public initialSetup = true
  public reconnects: number | null = null

  constructor(
    public opts: ClientOptions & {
      getUrl: () => Promise<string>
      maxReconnectSeconds?: number
      signal?: AbortSignal
      heartbeatIntervalMs?: number
      onReconnect?: () => void
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
        if (!this.initialSetup && this.opts.onReconnect) {
          this.opts.onReconnect()
        }
        this.initialSetup = false
        this.reconnects = 0
        if (this.ws) {
          this.startHeartbeat(this.ws)
        }
      })
      this.ws.once('close', (code, reason) => {
        if (code === CloseCode.Abnormal) {
          // Forward into an error to distinguish from a clean close
          ac.abort(
            new AbnormalCloseError(`Abnormal ws close: ${reason.toString()}`),
          )
        }
      })

      try {
        const wsStream = createWebSocketStream(this.ws, {
          signal: ac.signal,
          readableObjectMode: true, // Ensures frame bytes don't get buffered/combined together
        })
        for await (const chunk of wsStream) {
          yield chunk
        }
      } catch (_err) {
        const err =
          isErrnoException(_err) && _err.code === 'ABORT_ERR'
            ? _err.cause
            : _err
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

  send(data: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1 /* OPEN */) {
        reject(new Error('WebSocket is not connected'))
        return
      }
      this.ws.send(data, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1
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
  Abnormal = 1006,
  Policy = 1008,
}

function isReconnectable(err: unknown): boolean {
  // Network errors are reconnectable.
  // AuthenticationRequired and InvalidRequest XRPCErrors are not reconnectable.
  // @TODO method-specific XRPCErrors may be reconnectable, need to consider. Receiving
  // an invalid message is not current reconnectable, but the user can decide to skip them.
  if (isErrnoException(err) && typeof err.code === 'string') {
    return networkErrorCodes.includes(err.code)
  }
  return false
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
      // @ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68625
      signal: ac.signal,
    })
  }
}

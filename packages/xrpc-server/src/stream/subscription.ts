import { wait } from '@atproto/common'
import { WebSocket, ClientOptions } from 'ws'
import { byMessage } from './stream'
import { CloseCode } from './types'

export class Subscription<T = unknown> {
  constructor(
    public opts: ClientOptions & {
      service: string
      method: string
      maxReconnectSeconds?: number
      validate: (obj: unknown) => T | undefined
      getParams?: () =>
        | URLSearchParams
        | Promise<URLSearchParams | undefined>
        | undefined
    },
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    let reconnects: number | null = null
    const maxReconnectMs = 1000 * (this.opts.maxReconnectSeconds ?? 64)
    while (true) {
      if (reconnects !== null) {
        await wait(backoffMs(reconnects++, maxReconnectMs))
      }
      const ws = await this.getSocket()
      ws.once('open', () => (reconnects = 0))
      ws.once('close', (code, reason) => {
        if (code === CloseCode.Abnormal) {
          // Forward into an error to distinguish from a clean close
          ws.emit('error', new AbnormalCloseError(reason.toString()))
        }
      })
      try {
        for await (const message of byMessage(ws)) {
          const result = this.opts.validate(message.body) // @TODO map $type, handle bad validation
          if (result !== undefined) {
            yield result
          }
        }
      } catch (err) {
        ws.close() // No-ops if already closed or closing
        if (isReconnectable(err, reconnects)) {
          reconnects ??= 0 // Never reconnect with a null
          continue
        } else {
          throw err
        }
      }
      break // Other side cleanly ended stream and disconnected
    }
  }

  private async getSocket() {
    const params = await this.opts.getParams?.()
    const query = params?.toString() ?? ''
    const url = `${this.opts.service}/xrpc/${this.opts.method}?${query}`
    return new WebSocket(url, this.opts)
  }
}

export default Subscription

export class AbnormalCloseError extends Error {
  code = 'EWSABNORMALCLOSE'
}

function isReconnectable(err: unknown, reconnects: number | null): boolean {
  // The socket never opened on initial connection.
  if (reconnects === null) return false
  // Network errors are reconnectable.
  // AuthenticationRequired and InvalidRequest XRPCErrors are not reconnectable.
  // @TODO method-specific XRPCErrors may be reconnectable, need to consider.
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

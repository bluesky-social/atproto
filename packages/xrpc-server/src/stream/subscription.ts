import { wait } from '@atproto/common'
import { WebSocket, ClientOptions } from 'ws'
import { byMessage } from './stream'
import { CloseCode, DisconnectError } from './types'

export class Subscription<T = unknown> {
  constructor(
    public opts: ClientOptions & {
      service: string
      method: string
      maxReconnectSeconds?: number
      signal?: AbortSignal
      validate: (obj: unknown) => T | undefined
      onReconnectError?: (
        error: unknown,
        n: number,
        initialSetup: boolean,
      ) => void
      getParams?: () =>
        | Record<string, unknown>
        | Promise<Record<string, unknown> | undefined>
        | undefined
    },
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    let initialSetup = true
    let reconnects: number | null = null
    const maxReconnectMs = 1000 * (this.opts.maxReconnectSeconds ?? 64)
    while (true) {
      if (reconnects !== null) {
        const duration = initialSetup
          ? Math.min(1000, maxReconnectMs)
          : backoffMs(reconnects++, maxReconnectMs)
        await wait(duration)
      }
      const ws = await this.getSocket()
      const ac = new AbortController()
      if (this.opts.signal) {
        forwardSignal(this.opts.signal, ac)
      }
      ws.once('open', () => {
        initialSetup = false
        reconnects = 0
      })
      ws.once('close', (code, reason) => {
        if (code === CloseCode.Abnormal) {
          // Forward into an error to distinguish from a clean close
          ac.abort(
            new AbnormalCloseError(`Abnormal ws close: ${reason.toString()}`),
          )
        }
      })
      try {
        const cancelable = { signal: ac.signal }
        for await (const message of byMessage(ws, cancelable)) {
          const t = message.header.t
          const clone =
            message.body !== undefined ? { ...message.body } : undefined
          if (clone !== undefined && t !== undefined) {
            clone['$type'] = t.startsWith('#') ? this.opts.method + t : t
          }
          const result = this.opts.validate(clone)
          if (result !== undefined) {
            yield result
          }
        }
      } catch (_err) {
        const err = _err?.['code'] === 'ABORT_ERR' ? _err['cause'] : _err
        if (err instanceof DisconnectError) {
          // We cleanly end the connection
          ws.close(err.wsCode)
          break
        }
        ws.close() // No-ops if already closed or closing
        if (isReconnectable(err)) {
          reconnects ??= 0 // Never reconnect with a null
          this.opts.onReconnectError?.(err, reconnects, initialSetup)
          continue
        } else {
          throw err
        }
      }
      break // Other side cleanly ended stream and disconnected
    }
  }

  private async getSocket() {
    const params = (await this.opts.getParams?.()) ?? {}
    const query = encodeQueryParams(params)
    const url = `${this.opts.service}/xrpc/${this.opts.method}?${query}`
    return new WebSocket(url, this.opts)
  }
}

export default Subscription

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

function encodeQueryParams(obj: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(obj).forEach(([key, value]) => {
    const encoded = encodeQueryParam(value)
    if (Array.isArray(encoded)) {
      encoded.forEach((enc) => params.append(key, enc))
    } else {
      params.set(key, encoded)
    }
  })
  return params.toString()
}

// Adapted from xrpc, but without any lex-specific knowledge
function encodeQueryParam(value: unknown): string | string[] {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    } else if (Array.isArray(value)) {
      return value.flatMap(encodeQueryParam)
    } else if (!value) {
      return ''
    }
  }
  throw new Error(`Cannot encode ${typeof value}s into query params`)
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

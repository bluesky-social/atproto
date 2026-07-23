import { isPlainObject } from '@atproto/lex-data'
import { WebSocketClient } from '@atproto/ws-client'
import { ensureChunkIsMessage } from './stream.js'

export class Subscription<T = unknown> {
  constructor(
    public opts: {
      service: string
      method: string
      maxReconnectSeconds?: number
      heartbeatIntervalMs?: number
      headers?: Record<string, string> | Headers
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
    const ws = new WebSocketClient(
      async () => {
        const params = (await this.opts.getParams?.()) ?? {}
        const query = encodeQueryParams(params)
        return `${this.opts.service}/xrpc/${this.opts.method}?${query}`
      },
      {
        dataMode: 'binary',
        headers: this.opts.headers,
        maxReconnectSeconds: this.opts.maxReconnectSeconds,
        heartbeat: this.opts.heartbeatIntervalMs
          ? { intervalMs: this.opts.heartbeatIntervalMs }
          : undefined,
        signal: this.opts.signal,
        onError: (error, reconnect) => {
          if (reconnect) {
            this.opts.onReconnectError?.(
              error,
              reconnect.attempt,
              reconnect.attempt === 0,
            )
          }
        },
      },
    )
    for await (const chunk of ws) {
      const message = ensureChunkIsMessage(chunk)
      const t = message.header.t

      const typedBody = isPlainObject(message.body)
        ? t !== undefined
          ? {
              ...message.body,
              $type: t.startsWith('#') ? this.opts.method + t : t,
            }
          : message.body
        : undefined

      const result = this.opts.validate(typedBody)
      if (result !== undefined) {
        yield result
      }
    }
  }
}

export default Subscription

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

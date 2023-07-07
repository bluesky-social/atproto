import { ClientOptions } from 'ws'
import { WebSocketKeepAlive } from './websocket-keepalive'
import { ensureChunkIsMessage } from './stream'

export class Subscription<T = unknown> {
  constructor(
    public opts: ClientOptions & {
      service: string
      method: string
      maxReconnectSeconds?: number
      heartbeatIntervalMs?: number
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
    const ws = new WebSocketKeepAlive({
      ...this.opts,
      getUrl: async () => {
        const params = (await this.opts.getParams?.()) ?? {}
        const query = encodeQueryParams(params)
        return `${this.opts.service}/xrpc/${this.opts.method}?${query}`
      },
    })
    for await (const chunk of ws) {
      const message = await ensureChunkIsMessage(chunk)
      const t = message.header.t
      const clone = message.body !== undefined ? { ...message.body } : undefined
      if (clone !== undefined && t !== undefined) {
        clone['$type'] = t.startsWith('#') ? this.opts.method + t : t
      }
      const result = this.opts.validate(clone)
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

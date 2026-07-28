import type {
  HeadersInit,
  Transport,
  TransportFactory,
  TransportHandlers,
  TransportOptions,
} from './transport.js'

// Minimal WHATWG WebSocket shape this adapter relies on.
type WebSocketCtor = new (
  url: string | URL,
  protocols?: string | string[],
) => WHATWGWebSocket

// Checked against the WHATWG WebSockets Standard (and undici's implementation):
// `binaryType` is 'blob' | 'arraybuffer'; the 'close' event is a CloseEvent
// with { code, reason, wasClean }; `send` also accepts Blob per spec, but this
// adapter only ever sends string | Uint8Array so the narrower type is accurate
// for our use.
interface WHATWGMessageEvent extends Event {
  readonly data: unknown
}

interface WHATWGCloseEvent extends Event {
  readonly code: number
  readonly reason: string
  readonly wasClean: boolean
}

// Browser 'error' events are ErrorEvents (which carry `error`); undici and
// some runtimes dispatch a plain Event. `error` is optional to span both.
interface WHATWGErrorEvent extends Event {
  readonly error?: unknown
}

interface WHATWGWebSocket {
  binaryType: 'blob' | 'arraybuffer'
  readonly protocol: string
  send(data: string | ArrayBufferLike | ArrayBufferView): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'open', listener: () => void): void
  addEventListener(
    type: 'message',
    listener: (ev: WHATWGMessageEvent) => void,
  ): void
  addEventListener(
    type: 'close',
    listener: (ev: WHATWGCloseEvent) => void,
  ): void
  addEventListener(
    type: 'error',
    listener: (ev: WHATWGErrorEvent) => void,
  ): void
}

export class BrowserTransport implements Transport {
  readonly capabilities = { heartbeat: false, pauseResume: false } as const
  readonly handlers: TransportHandlers

  #ws?: WHATWGWebSocket
  readonly #url: string | URL
  readonly #options?: TransportOptions
  readonly #WebSocketImpl: WebSocketCtor

  constructor(
    url: string | URL,
    handlers: TransportHandlers,
    options?: TransportOptions,
    // Injectable for tests; defaults to the browser global.
    WebSocketImpl: WebSocketCtor = (globalThis as { WebSocket: WebSocketCtor })
      .WebSocket,
  ) {
    // The WHATWG WebSocket API has no request-header mechanism, so headers
    // would be silently dropped — which usually means broken auth. Fail loudly
    // at construction instead. (The browser entrypoint's option types omit
    // `headers`, but a consumer type-checking against the Node.js entrypoint
    // can still reach here at runtime.)
    if (hasHeaders(options?.headers)) {
      throw new TypeError(
        'WebSocket headers are not supported in the browser; use URL or subprotocol-based auth instead',
      )
    }
    // We only explicitly support Node.js and browsers, but this transport is
    // also the fallback for other runtimes (Expo, Bun, Deno, workers) — fail
    // loudly where a global WebSocket is genuinely absent.
    if (!WebSocketImpl) {
      throw new TypeError('WebSocket is not available in this environment')
    }
    this.#url = url
    this.handlers = handlers
    this.#options = options
    this.#WebSocketImpl = WebSocketImpl
  }

  open(): void {
    const ws = new this.#WebSocketImpl(this.#url, this.#options?.protocols)
    this.#ws = ws
    ws.binaryType = 'arraybuffer'
    ws.addEventListener('open', () => this.handlers.onOpen())
    ws.addEventListener('message', (ev) => {
      const { data } = ev
      if (typeof data === 'string') {
        this.handlers.onMessage(data)
      } else if (data instanceof ArrayBuffer) {
        // With binaryType 'arraybuffer', spec-compliant sockets deliver
        // binary data as ArrayBuffer only; anything else fails loudly below.
        this.handlers.onMessage(new Uint8Array(data))
      } else {
        this.handlers.onError(
          new Error('Unsupported WebSocket message data type'),
        )
      }
    })
    ws.addEventListener('close', (ev) => {
      this.handlers.onClose(ev.code, ev.reason, ev.wasClean)
    })
    ws.addEventListener('error', (ev) => {
      this.handlers.onError(new Error('WebSocket error', { cause: ev.error }))
    })
  }

  get protocol(): string | null {
    // See NodeTransport: normalize the WHATWG '' unset/none marker to null.
    return this.#ws?.protocol || null
  }

  async send(data: string | Uint8Array): Promise<void> {
    // No flush notification in the browser: resolve on hand-off ("accepted").
    this.#ws!.send(data)
  }

  ping(): void {
    // No protocol ping in the browser; capabilities.heartbeat === false.
  }

  pause(): void {
    // No read-side backpressure in the browser; capabilities.pauseResume === false.
  }

  resume(): void {
    // No read-side backpressure in the browser; capabilities.pauseResume === false.
  }

  close(code?: number, reason?: string): void {
    this.#ws?.close(code, reason)
  }

  terminate(): void {
    // No RST equivalent; a polite close is the strongest teardown available.
    this.#ws?.close()
  }
}

export const createTransport: TransportFactory = (url, handlers, options) =>
  new BrowserTransport(url, handlers, options)

function hasHeaders(headers?: HeadersInit): boolean {
  if (!headers) return false
  // Headers normalizes every HeadersInit form (record, entry pairs, Headers).
  for (const _ of new Headers(headers)) return true
  return false
}

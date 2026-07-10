import type {
  Transport,
  TransportFactory,
  TransportHandlers,
} from './transport.js'

// Minimal WHATWG WebSocket shape this adapter relies on.
type WebSocketCtor = new (
  url: string | URL,
  protocols?: string | string[],
) => WHATWGWebSocket

interface WHATWGWebSocket {
  binaryType: string
  readonly protocol: string
  send(data: string | ArrayBufferLike | ArrayBufferView): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'open', listener: () => void): void
  addEventListener(
    type: 'message',
    listener: (ev: { data: unknown }) => void,
  ): void
  addEventListener(
    type: 'close',
    listener: (ev: { code: number; reason: string; wasClean: boolean }) => void,
  ): void
  addEventListener(type: 'error', listener: (ev: unknown) => void): void
}

export class BrowserTransport implements Transport {
  readonly capabilities = { heartbeat: false, pauseResume: false } as const
  handlers!: TransportHandlers

  private readonly ws: WHATWGWebSocket

  constructor(
    url: string | URL,
    protocols?: string | string[],
    // Injectable for tests; defaults to the browser global.
    WebSocketImpl: WebSocketCtor = (globalThis as { WebSocket: WebSocketCtor })
      .WebSocket,
  ) {
    this.ws = new WebSocketImpl(url, protocols)
    this.ws.binaryType = 'arraybuffer'
    this.ws.addEventListener('open', () => this.handlers.onOpen())
    this.ws.addEventListener('message', (ev: { data: unknown }) => {
      const { data } = ev
      if (typeof data === 'string') {
        this.handlers.onMessage(data, false)
      } else if (data instanceof ArrayBuffer) {
        this.handlers.onMessage(new Uint8Array(data), true)
      } else if (ArrayBuffer.isView(data)) {
        const view = data as ArrayBufferView
        this.handlers.onMessage(
          new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
          true,
        )
      } else {
        this.handlers.onError(
          new Error('Unsupported WebSocket message data type'),
        )
      }
    })
    this.ws.addEventListener(
      'close',
      (ev: { code: number; reason: string; wasClean: boolean }) => {
        this.handlers.onClose(ev.code, ev.reason, ev.wasClean)
      },
    )
    this.ws.addEventListener('error', () => {
      this.handlers.onError(new Error('WebSocket error'))
    })
  }

  get protocol(): string {
    return this.ws.protocol
  }

  send(data: string | Uint8Array, onFlush: (err?: Error) => void): void {
    // No completion callback in the browser: resolve on hand-off ("accepted").
    try {
      this.ws.send(data)
      onFlush()
    } catch (err) {
      onFlush(err instanceof Error ? err : new Error(String(err)))
    }
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
    this.ws.close(code, reason)
  }

  terminate(): void {
    // No RST equivalent; a polite close is the strongest teardown available.
    this.ws.close()
  }
}

export const createBrowserTransport: TransportFactory = (url, protocols) =>
  new BrowserTransport(url, protocols)

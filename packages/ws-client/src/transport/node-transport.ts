import { WebSocket } from 'ws'
import { CloseCode } from '../lib/close-codes.js'
import type {
  Transport,
  TransportFactory,
  TransportHandlers,
  TransportOptions,
} from './transport.js'

export class NodeTransport implements Transport {
  readonly capabilities = { heartbeat: true, pauseResume: true } as const
  handlers!: TransportHandlers

  #ws?: WebSocket
  readonly #url: string | URL
  readonly #options?: TransportOptions

  constructor(url: string | URL, options?: TransportOptions) {
    this.#url = url
    this.#options = options
  }

  open(): void {
    const headers = toHeaderRecord(this.#options?.headers)
    // ws offers permessage-deflate by default (`perMessageDeflate: true`),
    // sending the same extension offer a browser WebSocket does. Leave it in
    // place — cross-platform behavior is deliberately identical here.
    const ws = new WebSocket(
      this.#url,
      this.#options?.protocols,
      headers ? { headers } : undefined,
    )
    this.#ws = ws
    // Pin the default so every frame arrives as a single Buffer. ws's RawData
    // is `Buffer | ArrayBuffer | Buffer[]`; only 'nodebuffer' guarantees Buffer
    // for both text and binary frames, which is what the listener below assumes.
    ws.binaryType = 'nodebuffer'
    ws.on('open', () => this.handlers.onOpen())
    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Yield the Buffer's Uint8Array view without copying.
        this.handlers.onMessage(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
          true,
        )
      } else {
        this.handlers.onMessage(data.toString('utf8'), false)
      }
    })
    ws.on('pong', () => this.handlers.onPong())
    ws.on('close', (code: number, reason: Buffer) => {
      this.handlers.onClose(
        code,
        reason.toString('utf8'),
        code === CloseCode.Normal,
      )
    })
    ws.on('error', (err: Error) => this.handlers.onError(err))
  }

  get protocol(): string {
    return this.#ws?.protocol ?? ''
  }

  send(data: string | Uint8Array, onFlush: (err?: Error) => void): void {
    this.#ws!.send(data, (err) => onFlush(err ?? undefined))
  }

  ping(): void {
    this.#ws?.ping()
  }

  pause(): void {
    this.#ws?.pause()
  }

  resume(): void {
    this.#ws?.resume()
  }

  close(code?: number, reason?: string): void {
    this.#ws?.close(code, reason)
  }

  terminate(): void {
    this.#ws?.terminate()
  }
}

export const createNodeTransport: TransportFactory = (url, options) =>
  new NodeTransport(url, options)

function toHeaderRecord(
  headers?: Record<string, string> | Headers,
): Record<string, string> | undefined {
  if (!headers) return undefined
  if (headers instanceof Headers) {
    const record: Record<string, string> = {}
    headers.forEach((value, key) => {
      record[key] = value
    })
    return record
  }
  return headers
}

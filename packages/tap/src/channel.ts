import { ClientOptions } from 'ws'
import { Deferrable, createDeferrable } from '@atproto/common'
import { lexParse } from '@atproto/lex'
import { WebSocketKeepAlive } from '@atproto/ws-client'
import { TapEvent, parseTapEvent } from './types'
import { formatAdminAuthHeader, isCausedBySignal } from './util'

export interface HandlerOpts {
  signal: AbortSignal
  ack: () => Promise<void>
}

export interface TapHandler {
  onEvent: (evt: TapEvent, opts: HandlerOpts) => void | Promise<void>
  onError: (err: Error) => void
}

export type TapWebsocketOptions = ClientOptions & {
  adminPassword?: string
  maxReconnectSeconds?: number
  heartbeatIntervalMs?: number
  onReconnectError?: (error: unknown, n: number, initialSetup: boolean) => void
}

type BufferedAck = {
  id: number
  defer: Deferrable
}

export class TapChannel implements AsyncDisposable {
  private ws: WebSocketKeepAlive
  private handler: TapHandler

  private readonly abortController: AbortController = new AbortController()
  private readonly destroyDefer: Deferrable = createDeferrable()

  private bufferedAcks: BufferedAck[] = []

  constructor(
    url: string,
    handler: TapHandler,
    wsOpts: TapWebsocketOptions = {},
  ) {
    this.handler = handler
    const { adminPassword, ...rest } = wsOpts
    let headers = rest.headers
    if (adminPassword) {
      headers ??= {}
      headers['Authorization'] = formatAdminAuthHeader(adminPassword)
    }
    this.ws = new WebSocketKeepAlive({
      getUrl: async () => url,
      onReconnect: () => {
        this.flushBufferedAcks()
      },
      signal: this.abortController.signal,
      ...rest,
      headers,
    })
  }

  async ackEvent(id: number): Promise<void> {
    if (this.ws.isConnected()) {
      try {
        await this.sendAck(id)
      } catch {
        await this.bufferAndSendAck(id)
      }
    } else {
      await this.bufferAndSendAck(id)
    }
  }

  private async sendAck(id: number): Promise<void> {
    await this.ws.send(JSON.stringify({ type: 'ack', id }))
  }

  // resolves after the ack has been actually sent
  private async bufferAndSendAck(id: number): Promise<void> {
    const defer = createDeferrable()
    this.bufferedAcks.push({
      id,
      defer,
    })
    await defer.complete
  }

  private async flushBufferedAcks(): Promise<void> {
    while (this.bufferedAcks.length > 0) {
      try {
        const ack = this.bufferedAcks.at(0)
        if (!ack) {
          return
        }
        await this.sendAck(ack.id)
        ack.defer.resolve()
        this.bufferedAcks = this.bufferedAcks.slice(1)
      } catch (cause) {
        const error = new Error(
          `failed to send ack for event ${this.bufferedAcks[0]}`,
          { cause },
        )
        this.handler.onError(error)
        return
      }
    }
  }

  async start() {
    this.abortController.signal.throwIfAborted()
    try {
      for await (const chunk of this.ws) {
        await this.processWsEvent(chunk)
      }
    } catch (err) {
      if (!isCausedBySignal(err, this.abortController.signal)) {
        throw err
      }
    } finally {
      this.destroyDefer.resolve()
    }
  }

  private async processWsEvent(chunk: Uint8Array) {
    let evt: TapEvent
    try {
      const data = lexParse(chunk.toString(), {
        // Reject invalid CIDs and blobs
        strict: true,
      })
      evt = parseTapEvent(data)
    } catch (cause) {
      const error = new Error(`Failed to parse message`, { cause })
      this.handler.onError(error)
      return
    }

    try {
      await this.handler.onEvent(evt, {
        signal: this.abortController.signal,
        ack: async () => {
          await this.ackEvent(evt.id)
        },
      })
    } catch (cause) {
      // Don't ack on error - let Tap retry
      const error = new Error(`Failed to process event ${evt.id}`, { cause })
      this.handler.onError(error)
      return
    }
  }

  async destroy(): Promise<void> {
    this.abortController.abort()
    await this.destroyDefer.complete
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy()
  }
}

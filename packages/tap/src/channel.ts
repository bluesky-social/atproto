import { ClientOptions } from 'ws'
import { Deferrable, createDeferrable, isErrnoException } from '@atproto/common'
import { WebSocketKeepAlive } from '@atproto/ws-client'
import { TapEvent, parseTapEvent } from './events'

export interface HandlerOpts {
  signal: AbortSignal
}

export interface TapHandler {
  onEvent: (evt: TapEvent, opts?: HandlerOpts) => void | Promise<void>
  onError: (err: Error) => void
}

export type TapWebsocketOptions = ClientOptions & {
  maxReconnectSeconds?: number
  heartbeatIntervalMs?: number
  onReconnectError?: (error: unknown, n: number, initialSetup: boolean) => void
}

type BufferedAck = {
  id: number
  defer: Deferrable
}

export class TapChannel {
  private ws: WebSocketKeepAlive
  private handler: TapHandler

  private abortController: AbortController
  private destroyDefer: Deferrable

  private bufferedAcks: BufferedAck[] = []

  constructor(
    url: string,
    handler: TapHandler,
    wsOpts: TapWebsocketOptions = {},
  ) {
    this.abortController = new AbortController()
    this.destroyDefer = createDeferrable()
    this.handler = handler
    this.ws = new WebSocketKeepAlive({
      getUrl: async () => url,
      onReconnect: () => {
        this.flushBufferedAcks()
      },
      signal: this.abortController.signal,
      ...wsOpts,
    })
  }

  async ackEvent(id: number): Promise<void> {
    if (this.ws.isConnected()) {
      try {
        this.sendAck(id)
        await this.ws.send(JSON.stringify({ type: 'ack', id }))
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
      } catch (err) {
        this.handler.onError(
          new Error(`failed to send ack for event ${this.bufferedAcks[0]}`, {
            cause: err,
          }),
        )
        return
      }
    }
  }

  async start() {
    try {
      for await (const chunk of this.ws) {
        await this.processWsEvent(chunk)
      }
    } catch (err) {
      if (isErrnoException(err) && err.name === 'AbortError') {
        this.destroyDefer.resolve()
      } else {
        throw err
      }
    }
  }

  private async processWsEvent(chunk: Uint8Array) {
    let evt: TapEvent
    try {
      const data = chunk.toString()
      evt = parseTapEvent(JSON.parse(data))
    } catch (err) {
      this.handler.onError(new Error('Failed to parse message', { cause: err }))
      return
    }

    try {
      await this.handler.onEvent(evt, { signal: this.abortController.signal })
      await this.ackEvent(evt.id)
    } catch (err) {
      // Don't ack on error - let Tap retry
      this.handler.onError(
        new Error(`Failed to process event ${evt.id}`, { cause: err }),
      )
      return
    }
  }

  async destroy(): Promise<void> {
    this.abortController.abort()
    await this.destroyDefer.complete
  }
}

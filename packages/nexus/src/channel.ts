import { ClientOptions } from 'ws'
import { Deferrable, createDeferrable } from '@atproto/common'
import { NexusEvent, parseNexusEvent } from './events'
import { WebSocketKeepAlive } from './websocket-keepalive'

export interface HandlerOpts {
  signal: AbortSignal
}

export interface NexusHandler {
  onEvent: (evt: NexusEvent, opts?: HandlerOpts) => void | Promise<void>
  onError: (err: Error) => void
}

export type NexusWebsocketOptions = ClientOptions & {
  maxReconnectSeconds?: number
  heartbeatIntervalMs?: number
  onReconnectError?: (error: unknown, n: number, initialSetup: boolean) => void
}

export class NexusChannel {
  private ws: WebSocketKeepAlive
  private handler: NexusHandler

  private abortController: AbortController
  private destroyDefer: Deferrable

  private bufferedAcks: number[] = []

  constructor(
    url: string,
    handler: NexusHandler,
    wsOpts: NexusWebsocketOptions = {},
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

  async ackEvent(id: number): Promise<boolean> {
    if (this.ws.isConnected()) {
      try {
        await this.ws.send(JSON.stringify({ id }))
        return true
      } catch (err) {
        this.bufferedAcks.push(id)
        return false
      }
    } else {
      this.bufferedAcks.push(id)
      return false
    }
  }

  private async flushBufferedAcks() {
    while (this.bufferedAcks.length > 0) {
      try {
        const success = await this.ackEvent(this.bufferedAcks[0])
        if (success) {
          this.bufferedAcks = this.bufferedAcks.slice(1)
        }
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
      if (err && err['name'] === 'AbortError') {
        this.destroyDefer.resolve()
      } else {
        throw err
      }
    }
  }

  private async processWsEvent(chunk: Uint8Array) {
    let evt: NexusEvent
    try {
      const data = chunk.toString()
      evt = parseNexusEvent(JSON.parse(data))
    } catch (err) {
      this.handler.onError(new Error(`Failed to parse message: ${err}`))
      return
    }

    try {
      await this.handler.onEvent(evt, { signal: this.abortController.signal })
      await this.ackEvent(evt.id)
    } catch (err) {
      // Don't ack on error - let Nexus retry
      this.handler.onError(
        new Error(`Failed to prcoess event ${evt.id}: ${err}`),
      )
      return
    }
  }

  async destroy(): Promise<void> {
    this.abortController.abort()
    await this.destroyDefer.complete
  }
}

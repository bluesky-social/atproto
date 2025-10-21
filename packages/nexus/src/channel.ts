import { EventEmitter } from 'node:events'
import TypedEmitter from 'typed-emitter'
import { Data as WsData, WebSocket } from 'ws'
import { NexusEvent, parseNexusEvent } from './events'

export interface NexusChannelOptions {
  reconnect?: boolean
  reconnectDelay?: number
}

type NexusEvents = {
  open: () => void
  event: (evt: NexusEvent) => void
  error: (err: Error) => void
  reconnecting: (code: number, reason: string) => void
  close: () => void
}

export type NexusEmitter = TypedEmitter<NexusEvents>

export class NexusChannel extends (EventEmitter as new () => NexusEmitter) {
  ws: WebSocket | null = null
  url: string
  reconnect: boolean
  reconnectDelay: number
  closed = false
  reconnectTimer?: NodeJS.Timeout
  bufferedAcks: number[] = []

  constructor(url: string, options: NexusChannelOptions = {}) {
    super()
    this.url = url
    this.reconnect = options.reconnect ?? true
    this.reconnectDelay = options.reconnectDelay ?? 1000
  }

  ackEvent = (id: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (this.ws && this.isConnected()) {
        this.ws.send(JSON.stringify({ id }), (err) => {
          if (err) {
            reject(err)
          } else {
            resolve(true)
          }
        })
      } else {
        this.bufferedAcks.push(id)
        resolve(true)
      }
    })
  }

  private async flushBufferedAcks() {
    while (this.bufferedAcks.length > 0) {
      const id = this.bufferedAcks.shift()
      if (!id) {
        return
      }
      const success = await this.ackEvent(id)
      if (!success) {
        return
      }
    }
  }

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url)

    this.ws.on('open', () => {
      this.emit('open')
      this.flushBufferedAcks().catch((err) => {
        this.emit('error', new Error(`Failed to flush buffered acks: ${err}`))
      })
    })

    this.ws.on('message', (data: WsData) => {
      try {
        const evt = parseNexusEvent(JSON.parse(data.toString()), this.ackEvent)
        this.emit('event', evt)
      } catch (err) {
        this.emit('error', new Error(`Failed to parse message: ${err}`))
      }
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.ws = null
      if (this.reconnect && !this.closed) {
        this.emit('reconnecting', code, reason.toString())
        this.reconnectTimer = setTimeout(() => {
          this.connect()
        }, this.reconnectDelay)
      } else {
        this.emit('close')
      }
    })

    this.ws.on('error', (err: Error) => {
      this.emit('error', err)
    })
  }

  disconnect(): void {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

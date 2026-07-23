import { type Deferrable, createDeferrable } from '@atproto/common'
import { lexParse } from '@atproto/lex'
import {
  CloseCode,
  CloseError,
  type HeadersInit,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketClient,
} from '@atproto/ws-client'
import { type TapEvent, parseTapEvent } from './types.js'
import { formatAdminAuthHeader, isCausedBySignal } from './util.js'

// Matches the reconnect classification of the legacy WebSocketKeepAlive: only
// reconnect on a genuine transport failure (socket error, heartbeat/idle
// timeout) or an abnormal close (code 1006). Any other close code — including
// the synthetic "no status" 1005 a peer's bare `socket.close()` produces on
// the wire — ends the session, matching prior behavior exactly.
function shouldReconnect(error: unknown): boolean {
  if (error instanceof CloseError) {
    return error.code === CloseCode.Abnormal
  }
  return (
    error instanceof SocketError ||
    error instanceof HeartbeatTimeoutError ||
    error instanceof IdleTimeoutError
  )
}

export interface HandlerOpts {
  signal: AbortSignal
  ack: () => Promise<void>
}

export interface TapHandler {
  onEvent: (evt: TapEvent, opts: HandlerOpts) => void | Promise<void>
  onError: (err: Error) => void
}

export type TapWebsocketOptions = {
  adminPassword?: string
  maxReconnectSeconds?: number
  heartbeatIntervalMs?: number
  headers?: HeadersInit
  onReconnectError?: (error: unknown, n: number, initialSetup: boolean) => void
}

type BufferedAck = {
  id: number
  defer: Deferrable
}

export class TapChannel implements AsyncDisposable {
  private ws: WebSocketClient<'text'>
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
    const { adminPassword, headers: optHeaders, ...rest } = wsOpts
    const headers = new Headers(optHeaders)
    if (adminPassword) {
      headers.set('Authorization', formatAdminAuthHeader(adminPassword))
    }
    const { onReconnectError } = rest
    this.ws = new WebSocketClient(url, {
      dataMode: 'text',
      headers,
      maxReconnectSeconds: rest.maxReconnectSeconds,
      heartbeat: rest.heartbeatIntervalMs
        ? { intervalMs: rest.heartbeatIntervalMs }
        : undefined,
      signal: this.abortController.signal,
      shouldReconnect,
      // Flush buffered acks on each reconnect (not the initial open).
      onReconnect: () => {
        this.flushBufferedAcks()
      },
      onError: (error, reconnect) => {
        if (reconnect) {
          onReconnectError?.(error, reconnect.attempt, reconnect.attempt === 0)
        }
      },
    })
  }

  async ackEvent(id: number): Promise<void> {
    if (this.ws.connected) {
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
      // A CloseError only reaches here once `shouldReconnect` (above)
      // has already decided not to reconnect — i.e. the peer ended the
      // session with an ordinary close frame (any code but 1006). That is a
      // clean, expected stream end, matching WebSocketKeepAlive's prior
      // behavior of ending silently on any non-abnormal close.
      if (
        !isCausedBySignal(err, this.abortController.signal) &&
        !(err instanceof CloseError)
      ) {
        throw err
      }
    } finally {
      this.destroyDefer.resolve()
    }
  }

  private async processWsEvent(chunk: string) {
    let evt: TapEvent
    try {
      const data = lexParse(chunk, {
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

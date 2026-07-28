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
  WebSocketClientError,
} from '@atproto/ws-client'
import { type TapEvent, parseTapEvent } from './types.js'
import { formatAdminAuthHeader, isCausedBySignal } from './util.js'

// Matches the reconnect classification the legacy errno-matching client had:
// reconnect only on a genuine transport failure or an abnormal close (1006).
// Any other close code — including the synthetic 1005 a bare socket.close()
// produces — ends the session, as before.
function shouldReconnect(error: unknown): boolean {
  if (error instanceof CloseError) {
    return error.code === CloseCode.Abnormal
  }
  if (
    error instanceof SocketError ||
    error instanceof HeartbeatTimeoutError ||
    error instanceof IdleTimeoutError
  ) {
    // Defer to each error's own classification so this can't drift from the
    // taxonomy as it evolves.
    return error.shouldRetry()
  }
  return false
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
  /** Applied to the connection's upgrade request (Node.js only). */
  headers?: HeadersInit
  onReconnectError?: (error: unknown, n: number, initialSetup: boolean) => void
}

export class TapChannel implements AsyncDisposable {
  private ws: WebSocketClient<'text'>
  private handler: TapHandler

  private readonly abortController: AbortController = new AbortController()
  private readonly destroyDefer: Deferrable = createDeferrable()

  constructor(
    url: string,
    handler: TapHandler,
    wsOpts: TapWebsocketOptions = {},
  ) {
    this.handler = handler
    const { adminPassword, onReconnectError } = wsOpts
    const headers = new Headers(wsOpts.headers)
    if (adminPassword) {
      headers.set('Authorization', formatAdminAuthHeader(adminPassword))
    }
    this.ws = new WebSocketClient(url, {
      dataMode: 'text',
      headers,
      maxReconnectSeconds: wsOpts.maxReconnectSeconds,
      heartbeat: wsOpts.heartbeatIntervalMs
        ? { intervalMs: wsOpts.heartbeatIntervalMs }
        : undefined,
      signal: this.abortController.signal,
      shouldReconnect,
      onError: (error, reconnect) => {
        if (reconnect) {
          onReconnectError?.(error, reconnect.attempt, reconnect.attempt === 0)
        }
      },
    })
  }

  /**
   * Resolves once the ack has actually been sent, retrying across reconnects.
   *
   * The client's own queue holds an ack issued while disconnected and flushes
   * it on the next connection, but at-most-once: a flush that fails rejects.
   * Re-calling `send()` re-queues, which is what turns that into the
   * retry-until-sent guarantee the caller expects.
   *
   * Retries re-queue at the tail and so are not strictly FIFO, and a send that
   * fails mid-hand-off may be delivered twice. Both are safe: Tap acks are
   * per-event, idempotent (a repeat ack for an already-acked id is a no-op)
   * and order-insensitive.
   */
  async ackEvent(id: number): Promise<void> {
    const message = JSON.stringify({ type: 'ack', id })
    for (;;) {
      if (this.abortController.signal.aborted) return
      try {
        return await this.ws.send(message)
      } catch (cause) {
        if (this.abortController.signal.aborted) return
        // A destroyed client or a full queue will never accept this ack, so
        // retrying would spin forever — surface it instead.
        if (cause instanceof WebSocketClientError) throw cause
        this.handler.onError(
          new Error(`failed to send ack for event ${id}`, { cause }),
        )
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
      // A CloseError only reaches here once `shouldReconnect` has already
      // declined to retry — i.e. the peer ended the session with an ordinary
      // close frame. That is an expected end, matching the previous client's
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

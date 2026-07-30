import { type Deferrable, createDeferrable } from '@atproto/common'
import { lexParse } from '@atproto/lex'
import {
  CloseCode,
  CloseError,
  type HeadersInit,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  type Sender,
  SocketError,
  type WebSocketIterable,
  websocket,
} from '@atproto/ws-client'
import { type TapEvent, parseTapEvent } from './types.js'
import { formatAdminAuthHeader, isCausedBySignal } from './util.js'

// Matches the classification the legacy errno-matching client had: reconnect only
// on a genuine transport failure or an abnormal close (1006). Any other close
// code, including the synthetic 1005 a bare socket.close() produces, ends the
// session as before.
function shouldReconnect(error: unknown): boolean {
  if (error instanceof CloseError) {
    return error.code === CloseCode.Abnormal
  }
  if (
    error instanceof SocketError ||
    error instanceof HeartbeatTimeoutError ||
    error instanceof IdleTimeoutError
  ) {
    // Defer to each error's own answer so this can't drift from the taxonomy.
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

function ackMessage(id: number): string {
  return JSON.stringify({ type: 'ack', id })
}

export class TapChannel implements AsyncDisposable {
  private ws: WebSocketIterable<'text'>
  private handler: TapHandler

  private readonly abortController: AbortController = new AbortController()
  private readonly destroyDefer: Deferrable = createDeferrable()

  /** The current connection's sender, or undefined between connections. */
  private sender?: Sender<'text'>
  /**
   * Acks accepted while there was no connection to send them on, flushed by the
   * `onConnect` hook below.
   *
   * Not a list of promises the caller awaits, deliberately: a handler runs inside
   * the iteration, and the reconnect that would flush it only happens when the
   * iteration advances — so awaiting delivery from a handler would block the very
   * pull that makes delivery possible. Acks are recorded and the handler
   * continues; Tap redelivers anything it never sees acked.
   */
  private readonly pendingAcks = new Set<number>()

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
    this.ws = websocket(url, {
      dataMode: 'text',
      headers,
      maxReconnectSeconds: wsOpts.maxReconnectSeconds,
      // `{}` means "on at the default interval"; see Subscription.
      heartbeat: wsOpts.heartbeatIntervalMs
        ? { intervalMs: wsOpts.heartbeatIntervalMs }
        : {},
      signal: this.abortController.signal,
      shouldReconnect,
      // Fires for every connection, the first included, so an ack recorded before
      // anything ever connected is flushed by whichever connection comes up.
      onConnect: (sender) => {
        this.sender = sender
        void this.flushPendingAcks()
      },
      onDisconnect: () => {
        this.sender = undefined
      },
      // Only retries are reported here; a fatal error reaches `start()` as the
      // iterator's rejection instead.
      onReconnect: (error, { attempt }) => {
        onReconnectError?.(error, attempt, attempt === 0)
      },
    })
  }

  /**
   * Records an ack for delivery. Resolves once the ack has been sent, or accepted
   * for the next connection — not once the peer has processed it.
   *
   * It can't mean more than that: a handler runs inside the iteration, and a
   * reconnect only happens when the iteration advances, so awaiting confirmed
   * delivery here would block the pull delivery depends on. Tap's own
   * at-least-once redelivery covers an ack lost with its connection.
   *
   * Acks are per-event, idempotent, and order-insensitive server-side (see
   * Outbox.AckEvent), so a duplicate or out-of-order ack is harmless.
   */
  async ackEvent(id: number): Promise<void> {
    const sender = this.sender
    if (!sender) {
      this.pendingAcks.add(id)
      return
    }
    try {
      await sender.send(ackMessage(id))
    } catch {
      // The connection died under us: hand the ack to the next one rather than
      // reporting a failure the caller can do nothing about.
      this.pendingAcks.add(id)
    }
  }

  // Driven by `onConnect`, never by a handler: it runs off the socket's own event,
  // so it doesn't depend on the iteration making progress.
  private async flushPendingAcks(): Promise<void> {
    const sender = this.sender
    if (!sender) return
    for (const id of [...this.pendingAcks]) {
      try {
        await sender.send(ackMessage(id))
        this.pendingAcks.delete(id)
      } catch (cause) {
        // Still unsendable; leave it queued for the connection after this one.
        this.handler.onError(
          new Error(`failed to send ack for event ${id}`, { cause }),
        )
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
      // A CloseError only reaches here once `shouldReconnect` has declined to
      // retry — i.e. the peer ended the session with an ordinary close frame.
      // That's an expected end, matching the previous client's behavior of
      // ending silently on any non-abnormal close.
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

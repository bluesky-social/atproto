import { WebSocketClientError } from './lib/errors.js'
import { invokeHook } from './lib/invoke-hook.js'
import type { DataMode, MessageOf } from './message-channel.js'
import type { Sender } from './transport/transport.js'
import type { Awaitable, WebSocketFn, WebSocketOptions } from './websocket.js'

export interface WebSocketClientOptions<M extends DataMode = 'auto'>
  extends WebSocketOptions<M> {
  /** Max messages held while disconnected. Default 64. */
  sendQueueLimit?: number
}

export type NodeWebSocketClientOptions<M extends DataMode = 'auto'> =
  WebSocketClientOptions<M>
export type BrowserWebSocketClientOptions<M extends DataMode = 'auto'> = Omit<
  WebSocketClientOptions<M>,
  'headers'
>

const DEFAULT_SEND_QUEUE_LIMIT = 64

interface QueueItem<M extends DataMode> {
  data: MessageOf<M>
  resolve: () => void
  reject: (error: unknown) => void
}

/**
 * A thin wrapper over the `websocket()` generator, for the one thing the
 * generator itself can't do: accept a `send()` call while disconnected.
 * Reading is already fully served by the generator — this class adds only a
 * bounded send queue plus `AsyncDisposable`, and otherwise forwards straight
 * through. No `close()`, no `readyState`, no reconnect logic of its own.
 */
export class WebSocketClientBase<M extends DataMode = 'auto'>
  implements AsyncIterable<MessageOf<M>, void, undefined>, AsyncDisposable
{
  readonly #websocketFn: WebSocketFn
  readonly #url: string | URL | (() => Awaitable<string | URL>)
  readonly #options: WebSocketClientOptions<M>
  readonly #sendQueueLimit: number
  readonly #queue: QueueItem<M>[] = []

  #sender: Sender<M> | undefined
  #iterator: AsyncIterator<MessageOf<M>, void, undefined> | undefined
  #iterated = false
  #destroyed = false
  #disposed: Promise<void> | undefined

  constructor(
    websocketFn: WebSocketFn,
    url: string | URL | (() => Awaitable<string | URL>),
    options: WebSocketClientOptions<M> = {},
  ) {
    this.#websocketFn = websocketFn
    this.#url = url
    this.#options = options
    this.#sendQueueLimit = options.sendQueueLimit ?? DEFAULT_SEND_QUEUE_LIMIT
  }

  /** Whether a live sender is currently held — i.e. `send()` delegates rather than queues. */
  get connected(): boolean {
    return this.#sender !== undefined
  }

  /**
   * With a live sender, delegates and returns its promise as-is: a rejection
   * propagates rather than being queued, since silently retrying a send the
   * caller already observed failing would be a hidden retry it can't see or
   * control.
   *
   * Without one, queues up to `sendQueueLimit` and resolves (or rejects) once
   * a later open/reconnect flushes it — at-most-once, like the sender itself:
   * a flush-time failure rejects that queued promise and does not re-queue
   * it. At-least-once delivery is a consumer-side concern: catch the
   * rejection and call `send()` again to re-queue for the next connection.
   */
  send(data: MessageOf<M>): Promise<void> {
    const sender = this.#sender
    if (sender) return sender.send(data)
    if (this.#destroyed) {
      return Promise.reject(
        new WebSocketClientError('Cannot send: the stream has ended'),
      )
    }
    if (this.#queue.length >= this.#sendQueueLimit) {
      return Promise.reject(
        new WebSocketClientError(
          `Cannot send: queue limit of ${this.#sendQueueLimit} exceeded`,
        ),
      )
    }
    return new Promise<void>((resolve, reject) => {
      this.#queue.push({ data, resolve, reject })
    })
  }

  /**
   * Single-use, like the underlying generator. Creates it via `websocketFn`,
   * wiring the class's own bookkeeping into `onOpen`/`onReconnect`/`onClose`
   * ahead of the caller's own hooks, then returns it directly — every other
   * pull is served by the generator itself.
   */
  [Symbol.asyncIterator](): AsyncIterator<MessageOf<M>, void, undefined> {
    if (this.#iterated) {
      throw new WebSocketClientError(
        'WebSocketClient can only be iterated once',
      )
    }
    if (this.#destroyed) {
      throw new WebSocketClientError(
        'Cannot iterate: the stream has already ended',
      )
    }
    this.#iterated = true

    const { onOpen, onReconnect, onClose } = this.#options
    const iterator = this.#websocketFn(this.#url, {
      ...this.#options,
      onOpen: (sender) => {
        this.#onConnect(sender)
        invokeHook(onOpen, sender)
      },
      onReconnect: (sender) => {
        this.#onConnect(sender)
        invokeHook(onReconnect, sender)
      },
      onClose: (detail) => {
        this.#onTerminal()
        invokeHook(onClose, detail)
      },
    })
    this.#iterator = iterator
    return iterator
  }

  /**
   * Idempotent: drives the stored iterator's `return()` so the generator's
   * `finally` runs (and, in turn, `onClose` and this class's own teardown),
   * resolving once that completes. A client that was never iterated has
   * nothing to tear down — an inert no-op.
   */
  [Symbol.asyncDispose](): Promise<void> {
    if (!this.#disposed) {
      const iterator = this.#iterator
      this.#disposed = iterator
        ? Promise.resolve(iterator.return?.()).then(() => undefined)
        : Promise.resolve()
    }
    return this.#disposed
  }

  // Called on the generator's onOpen (first connection) and onReconnect
  // (every later one) alike: the bookkeeping is identical either way. Stores
  // the fresh sender, then flushes whatever queued up while disconnected —
  // at-most-once, so a flush failure rejects that item without re-queueing.
  #onConnect(sender: Sender<M>): void {
    this.#sender = sender
    if (this.#queue.length === 0) return
    const pending = this.#queue.splice(0, this.#queue.length)
    for (const item of pending) {
      sender.send(item.data).then(item.resolve, item.reject)
    }
  }

  // Called on the generator's onClose — the single terminal transition, so
  // this runs exactly once. Drops the sender, marks the client destroyed, and
  // rejects everything still queued: nothing will ever flush it now.
  #onTerminal(): void {
    this.#destroyed = true
    this.#sender = undefined
    const pending = this.#queue.splice(0, this.#queue.length)
    for (const item of pending) {
      item.reject(new WebSocketClientError('Stream ended before send flushed'))
    }
  }
}

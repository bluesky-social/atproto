import { CloseCode, CloseError, websocket } from '@atproto/ws-client'

type JetstreamRecord = Record<string, unknown>
type OnCreateCallback<T extends JetstreamRecord> = (
  e: CommitCreateEvent<T>,
) => Promise<void>

export type JetstreamOptions = {
  endpoint: string
  /**
   * The record collections that you want to receive updates for.
   * Leave this empty to receive updates for all record collections.
   */
  wantedCollections?: string[]
  /**
   * The DIDs that you want to receive updates for.
   * Leave this empty to receive updates for all DIDs.
   */
  wantedDids?: string[]

  /**
   * The Unix timestamp in microseconds that you want to receive updates from.
   */
  cursor?: number
}
export type EventBase = {
  did: string
  time_us: number
  // @TODO: Limited to just commit events for now
  kind: 'commit'
}
export type CommitBase = {
  collection: string
  rkey: string
  cid: string
}
export interface CommitCreateEvent<
  RecordType extends JetstreamRecord,
> extends EventBase {
  kind: 'commit'
  commit: {
    operation: 'create'
    record: RecordType
  } & CommitBase
}

export interface CommitDeleteEvent extends EventBase {
  kind: 'commit'
  commit: {
    operation: 'delete'
  } & CommitBase
}

// The abort reason close() uses. Any abort closes the socket politely; a
// `CloseError` rather than a bare sentinel because the reason picks the close
// code sent to the peer — a CloseError names its own (1000 here), anything else
// defaults to 1000 anyway, so this spells the intent out. Its identity is also
// how start() tells our own shutdown from a real failure.
const STOPPED = new CloseError(CloseCode.Normal, 'jetstream stopped', true)

export class Jetstream {
  public url: URL
  readonly #abort = new AbortController()
  /** The `start()` run in flight, so `close()` can await its unwind. */
  #running?: Promise<void>
  /** The current cursor. */
  public cursor?: number

  constructor(opts: JetstreamOptions) {
    this.url = new URL(opts.endpoint)
    opts.wantedCollections?.forEach((collection) => {
      this.url.searchParams.append('wantedCollections', collection)
    })
    opts.wantedDids?.forEach((did) => {
      this.url.searchParams.append('wantedDids', did)
    })
    if (opts.cursor) this.cursor = opts.cursor
  }

  async start(options: {
    onCreate?: Record<string, OnCreateCallback<any>>
    onDelete?: Record<string, (e: CommitDeleteEvent) => Promise<void>>
  }) {
    // Retained so close() resolves only once the stream has unwound, and with it
    // the connection. Swallows its own outcome: a caller awaiting close() is
    // asking about shutdown, not about how the stream ended — that's what the
    // promise start() returns is for.
    const running = this.#consume(options)
    this.#running = running.catch(() => {})
    return running
  }

  async #consume(options: {
    onCreate?: Record<string, OnCreateCallback<any>>
    onDelete?: Record<string, (e: CommitDeleteEvent) => Promise<void>>
  }) {
    const ws = websocket(
      () => {
        if (this.cursor)
          this.url.searchParams.set('cursor', this.cursor.toString())
        return this.url.toString()
      },
      { dataMode: 'text', signal: this.#abort.signal },
    )

    try {
      for await (const message of ws) {
        const parsedMessage = JSON.parse(message)
        if (parsedMessage.kind === 'commit') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `record` is used via `typeof record` below
          const { collection, operation, record } = parsedMessage.commit || {}

          if (operation === 'create') {
            options.onCreate?.[collection]?.(
              parsedMessage as CommitCreateEvent<typeof record>,
            )
          } else if (operation === 'delete') {
            options.onDelete?.[collection]?.(parsedMessage as CommitDeleteEvent)
          }
        }
      }
    } catch (err) {
      // Our own close() is not a failure; anything else is.
      if (err !== STOPPED) throw err
    }
  }

  /**
   * Ends the stream and closes the connection, resolving once it has closed: the
   * abort tears the socket down, and the stream's own unwind is what tells us
   * that finished. A close() before start() is an inert no-op.
   */
  async close() {
    this.#abort.abort(STOPPED)
    await this.#running
  }
}

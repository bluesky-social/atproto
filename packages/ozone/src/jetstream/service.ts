import { WebSocketKeepAlive } from '@atproto/ws-client'

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
export interface CommitCreateEvent<RecordType extends JetstreamRecord>
  extends EventBase {
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

export class Jetstream {
  public ws?: WebSocketKeepAlive
  public url: URL
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
    this.ws = new WebSocketKeepAlive({
      getUrl: async () => {
        if (this.cursor)
          this.url.searchParams.set('cursor', this.cursor.toString())
        return this.url.toString()
      },
    })

    for await (const message of this.ws) {
      const parsedMessage = JSON.parse(message.toString())
      if (parsedMessage.kind === 'commit') {
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
  }

  /**
   * Closes the WebSocket connection.
   */
  close() {
    this.ws?.ws?.close()
  }
}

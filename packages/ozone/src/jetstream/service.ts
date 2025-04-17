// This is copied from https://github.com/skyware-js/jetstream
// The lib itself was difficult to integrate due to ESM module import issues so we had to resort to bringing over the implementation manually

import { EventEmitter } from 'node:events'
import { WebSocket } from 'partysocket'

/** Record mappings. */
export type Records = Record<string, any>

/**
 * Options for the {@link Jetstream} class.
 */
export interface JetstreamOptions<
  WantedCollections extends Collection = Collection,
> {
  /**
   * The full subscription endpoint to connect to.
   * @default "wss://jetstream1.us-east.bsky.network/subscribe"
   */
  endpoint?: string
  /**
   * The record collections that you want to receive updates for.
   * Leave this empty to receive updates for all record collections.
   */
  wantedCollections?: Array<WantedCollections>
  /**
   * The DIDs that you want to receive updates for.
   * Leave this empty to receive updates for all DIDs.
   */
  wantedDids?: Array<string>
  /**
   * The maximum size of a payload that this client would like to receive.
   * Zero means no limit, negative values are treated as zero.
   * @default 0
   */
  maxMessageSizeBytes?: number
  /**
   * The Unix timestamp in microseconds that you want to receive updates from.
   */
  cursor?: number
  /**
   * The WebSocket implementation to use (e.g. `import ws from "ws"`).
   * Not required if you are on Node 21.0.0 or newer, or another environment that provides a WebSocket implementation.
   */
  ws?: unknown
}

/**
 * The events that are emitted by the {@link Jetstream} class.
 * @see {@link Jetstream#on}
 */
export type JetstreamEvents<WantedCollections extends Collection = Collection> =
  {
    open: []
    close: []
    commit: [event: CommitEvent<WantedCollections>]
    account: [event: AccountEvent]
    identity: [event: IdentityEvent]
    error: [error: Error, cursor?: number]
  }

/**
 * The Jetstream client.
 */
export class Jetstream<
  WantedCollections extends CollectionOrWildcard = CollectionOrWildcard,
  ResolvedCollections extends
    Collection = ResolveLexiconWildcard<WantedCollections>,
> extends EventEmitter<JetstreamEvents<ResolvedCollections>> {
  /** WebSocket connection to the server. */
  public ws?: WebSocket

  /** The full connection URL. */
  public url: URL

  /** The current cursor. */
  public cursor?: number

  /** The WebSocket implementation to use. */
  private wsImpl?: unknown

  constructor(options?: JetstreamOptions<WantedCollections>) {
    super()
    options ??= {}
    if (options.ws) this.wsImpl = options.ws

    if (typeof globalThis.WebSocket === 'undefined' && !this.wsImpl) {
      throw new Error(
        `No WebSocket implementation was found in your environment. You must provide an implementation as the \`ws\` option.

For example, in a Node.js environment, \`npm install ws\` and then:
import { Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";

const jetstream = new Jetstream({
	ws: WebSocket,
});`,
      )
    }

    this.url = new URL(
      options.endpoint ?? 'wss://jetstream1.us-east.bsky.network/subscribe',
    )
    options.wantedCollections?.forEach((collection) => {
      this.url.searchParams.append('wantedCollections', collection)
    })
    options.wantedDids?.forEach((did) => {
      this.url.searchParams.append('wantedDids', did)
    })
    if (options.maxMessageSizeBytes) {
      this.url.searchParams.append(
        'maxMessageSizeBytes',
        `${options.maxMessageSizeBytes}`,
      )
    }
    if (options.cursor) this.cursor = options.cursor
  }

  /**
   * Opens a WebSocket connection to the server.
   */
  start() {
    this.ws = new WebSocket(() => this.createUrl(), null, {
      WebSocket: this.wsImpl,
    })

    this.ws.onopen = () => this.emit('open')
    this.ws.onclose = () => this.emit('close')
    this.ws.onerror = ({ error }) => this.emit('error', error, this.cursor)

    this.ws.onmessage = (data) => {
      try {
        const event = JSON.parse(data.data) as
          | CommitEvent<ResolvedCollections>
          | AccountEvent
          | IdentityEvent
        if (event.time_us > (this.cursor ?? 0)) this.cursor = event.time_us
        switch (event.kind) {
          case EventType.Commit:
            if (
              !event.commit?.collection ||
              !event.commit.rkey ||
              !event.commit.rev
            ) {
              return
            }
            if (
              event.commit.operation === CommitType.Create &&
              !event.commit.record
            ) {
              return
            }

            this.emit('commit', event)
            // @ts-expect-error – We know we can use collection name as an event.
            this.emit(event.commit.collection, event)
            break
          case EventType.Account:
            if (!event.account?.did) return
            this.emit('account', event)
            break
          case EventType.Identity:
            if (!event.identity?.did) return
            this.emit('identity', event)
            break
        }
      } catch (e) {
        this.emit(
          'error',
          e instanceof Error ? e : new Error(e as never),
          this.cursor,
        )
      }
    }
  }

  /**
   * Closes the WebSocket connection.
   */
  close() {
    this.ws?.close()
  }

  /**
   * Listen for records created in a specific collection.
   * @param collection The name of the collection to listen for.
   * @param listener A callback function that receives the commit event.
   */
  onCreate<T extends ResolvedCollections>(
    collection: T,
    listener: (event: CommitCreateEvent<T>) => void,
  ) {
    this.on(collection, ({ commit, ...event }) => {
      if (commit.operation === CommitType.Create) listener({ commit, ...event })
    })
  }

  /**
   * Listen for records updated in a specific collection.
   * @param collection The name of the collection to listen for.
   * @param listener A callback function that receives the commit event.
   */
  onUpdate<T extends ResolvedCollections>(
    collection: T,
    listener: (event: CommitUpdateEvent<T>) => void,
  ) {
    this.on(collection, ({ commit, ...event }) => {
      if (commit.operation === CommitType.Update) listener({ commit, ...event })
    })
  }

  /**
   * Listen for records deleted in a specific collection.
   * @param collection The name of the collection to listen for.
   * @param listener A callback function that receives the commit event.
   */
  onDelete<T extends ResolvedCollections>(
    collection: T,
    listener: (event: CommitDeleteEvent<T>) => void,
  ) {
    this.on(collection, ({ commit, ...event }) => {
      if (commit.operation === CommitType.Delete) listener({ commit, ...event })
    })
  }

  /**
   * Send a message to update options for the duration of this connection.
   */
  updateOptions(
    payload: Pick<
      JetstreamOptions,
      'wantedDids' | 'wantedCollections' | 'maxMessageSizeBytes'
    >,
  ) {
    if (!this.ws) throw new Error('Not connected.')

    if (payload.wantedDids) {
      this.url.searchParams.delete('wantedDids')
      payload.wantedDids.forEach((did) => {
        this.url.searchParams.append('wantedDids', did)
      })
    }
    if (payload.wantedCollections) {
      this.url.searchParams.delete('wantedCollections')
      payload.wantedCollections.forEach((collection) => {
        this.url.searchParams.append('wantedCollections', collection)
      })
    }
    if (payload.maxMessageSizeBytes) {
      this.url.searchParams.set(
        'maxMessageSizeBytes',
        payload.maxMessageSizeBytes.toString(),
      )
    }

    this.ws.send(JSON.stringify({ type: 'options_update', payload }))
  }

  private createUrl() {
    if (this.cursor) this.url.searchParams.set('cursor', this.cursor.toString())
    return this.url.toString()
  }

  /** Emitted when the connection is opened. */
  override on(event: 'open', listener: () => void): this
  /** Emitted when the connection is closed. */
  override on(event: 'close', listener: () => void): this
  /** Emitted when any commit is received. */
  override on(
    event: 'commit',
    listener: (event: CommitEvent<ResolvedCollections>) => void,
  ): this
  /** Emitted when an account is updated. */
  override on(event: 'account', listener: (event: AccountEvent) => void): this
  /** Emitted when an identity event is received. */
  override on(event: 'identity', listener: (event: IdentityEvent) => void): this
  /**
   * Emitted when a network error occurs.
   * @param listener A callback function that receives the error and the last known cursor.
   */
  override on(
    event: 'error',
    listener: (error: Error, cursor?: number) => void,
  ): this
  /**
   * Listen for all commits related to a specific collection.
   * @param collection The name of the collection.
   * @param listener  A callback function that receives the commit event.
   */
  override on<T extends ResolvedCollections>(
    collection: T,
    listener: (event: CommitEvent<T>) => void,
  ): this
  /**
   * @param event The event to listen for.
   * @param listener The callback function, called when the event is emitted.
   */
  override on(event: string, listener: (...args: any[]) => void) {
    return super.on(event, listener as never)
  }
}

/** Resolves a lexicon name to its record operation. */
export type ResolveLexicon<T extends string> = T extends keyof Records
  ? Records[T]
  : { $type: T }

/** Checks if any member of a union is assignable to a given operation. */
type UnionMemberIsAssignableTo<Union, AssignableTo> =
  // Distribute over union members
  Union extends Union
    ? // `Union` here refers to a given union member
      Union extends AssignableTo
      ? true
      : never
    : never

/** Resolves a wildcard string to the record types it matches. */
export type ResolveLexiconWildcard<T extends string> =
  // Match the prefix
  T extends `${infer Prefix}*`
    ? // Check that at least one collection name matches the prefix (we use `true extends` because `never` extends everything)
      true extends UnionMemberIsAssignableTo<
        keyof Records,
        `${Prefix}${string}`
      >
      ? // If so, return known matching collection names
        keyof Records & `${Prefix}${string}` extends infer Lexicon extends
          string
        ? Lexicon
        : never
      : // If no collection name matches the prefix, return as a operation-level wildcard string
        `${Prefix}${string}`
    : // If there's no wildcard, return the original string
      T

/** The name of a collection. */
export type Collection = keyof Records | string

/** Generates all possible wildcard strings that match a given collection name. */
type PossibleCollectionWildcards<CollectionName extends string> =
  CollectionName extends `${infer Prefix}.${infer Suffix}`
    ? `${Prefix}.*` | `${Prefix}.${PossibleCollectionWildcards<Suffix>}`
    : never

/** The name of a collection or a wildcard string matching multiple collections. */
export type CollectionOrWildcard =
  | PossibleCollectionWildcards<keyof Records>
  | Collection

/**
 * The types of events that are emitted by {@link Jetstream}.
 * @enum
 */
export const EventType = {
  /** A new commit. */
  Commit: 'commit',
  /** An account's status was updated. */
  Account: 'account',
  /** An account's identity was updated. */
  Identity: 'identity',
} as const
export type EventType = (typeof EventType)[keyof typeof EventType]

/**
 * The types of commits that can be received.
 * @enum
 */
export const CommitType = {
  /** A record was created. */
  Create: 'create',
  /** A record was updated. */
  Update: 'update',
  /** A record was deleted. */
  Delete: 'delete',
} as const
export type CommitType = (typeof CommitType)[keyof typeof CommitType]

/**
 * The base operation for events emitted by the {@link Jetstream} class.
 */
export interface EventBase {
  did: string
  time_us: number
  kind: EventType
}

/**
 * A commit event. Represents a commit to a user repository.
 */
export interface CommitEvent<RecordType extends string> extends EventBase {
  kind: typeof EventType.Commit
  commit: Commit<RecordType>
}

/** A commit event where a record was created. */
export interface CommitCreateEvent<RecordType extends string>
  extends CommitEvent<RecordType> {
  commit: CommitCreate<RecordType>
}

/** A commit event where a record was updated. */
export interface CommitUpdateEvent<RecordType extends string>
  extends CommitEvent<RecordType> {
  commit: CommitUpdate<RecordType>
}

/** A commit event where a record was deleted. */
export interface CommitDeleteEvent<RecordType extends string>
  extends CommitEvent<RecordType> {
  commit: CommitDelete<RecordType>
}

/**
 * An account event. Represents a change to an account's status on a host (e.g. PDS or Relay).
 */
export interface AccountEvent extends EventBase {
  kind: typeof EventType.Account
  account: Record<string, any>
}

/**
 * An identity event. Represents a change to an account's identity.
 */
export interface IdentityEvent extends EventBase {
  kind: typeof EventType.Identity
  identity: Record<string, any>
}

/**
 * The base operation for commit events.
 */
export interface CommitBase<RecordType extends string> {
  operation: CommitType
  rev: string
  collection: RecordType
  rkey: string
}

/**
 * A commit event representing a new record.
 */
export interface CommitCreate<RecordType extends string>
  extends CommitBase<RecordType> {
  operation: typeof CommitType.Create
  record: ResolveLexicon<RecordType>
  cid: string
}

/**
 * A commit event representing an update to an existing record.
 */
export interface CommitUpdate<RecordType extends string>
  extends CommitBase<RecordType> {
  operation: typeof CommitType.Update
  record: ResolveLexicon<RecordType>
  cid: string
}

/**
 * A commit event representing a deletion of an existing record.
 */
export interface CommitDelete<RecordType extends string>
  extends CommitBase<RecordType> {
  operation: typeof CommitType.Delete
}

/**
 * A commit event.
 */
export type Commit<RecordType extends string> =
  | CommitCreate<RecordType>
  | CommitUpdate<RecordType>
  | CommitDelete<RecordType>

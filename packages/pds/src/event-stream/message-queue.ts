import { sql } from 'kysely'
import PQueue from 'p-queue'
import Database from '../db'
import { MessageQueueCursor } from '../db/tables/message-queue-cursor'
import { dbLogger as log } from '../logger'
import {
  MessageQueue,
  Listenable,
  Listener,
  MessageOfType,
  isMessageOfType,
  MaybeAnyTopic,
} from './types'

const ANY_TOPIC = '*'

export class SqlMessageQueue implements MessageQueue {
  public topicQueues: Map<string, TopicQueue> = new Map()

  constructor(public name: string, private db: Database) {}

  async send(
    tx: Database,
    message: MessageOfType | MessageOfType[],
  ): Promise<void> {
    const messages = Array.isArray(message) ? message : [message]
    if (messages.length === 0) return

    const now = new Date().toISOString()
    const rows = messages.map((msg) => ({
      topic: msg.type,
      message: JSON.stringify(msg),
      createdAt: now,
    }))

    await tx.db.insertInto('message_queue').values(rows).execute()

    for (const msg of messages) {
      if (this.hasTopic(msg.type)) {
        this.processNext(msg.type).catch((err) => {
          log.error({ err }, 'error processing message')
        })
      }
    }
  }

  listen<T extends string, M extends MessageOfType<MaybeAnyTopic<T>>>(
    topic: T,
    listenable: Listenable<M>,
  ) {
    const topicQueue =
      this.topicQueues.get(topic) ?? new TopicQueue(this, this.db, topic)
    topicQueue.listen(listenable as Listenable) // @TODO avoid upcasts
    this.topicQueues.set(topic, topicQueue as TopicQueue)
  }

  async destroy() {
    const topicQueues = [...this.topicQueues.values()]
    await Promise.all(topicQueues.map((tq) => tq.destroy()))
  }

  async processAll(topic?: string): Promise<void> {
    if (topic !== undefined) {
      const tq = this.getTopicQueueOrThrow(topic)
      await tq.processAll()
      return
    }
    const topicQueues = [...this.topicQueues.values()]
    await Promise.all(topicQueues.map((tq) => tq.processAll()))
  }

  async processNext(topic?: string): Promise<void> {
    if (topic !== undefined) {
      const tq = this.getTopicQueueOrThrow(topic)
      await tq.processNext()
      return
    }
    const topicQueues = [...this.topicQueues.values()]
    await Promise.all(topicQueues.map((tq) => tq.processNext()))
  }

  private hasTopic(topic: string) {
    return this.topicQueues.has(topic) || this.topicQueues.has(ANY_TOPIC)
  }

  private getTopicQueue(topic: string) {
    return this.topicQueues.get(topic) ?? this.topicQueues.get(ANY_TOPIC)
  }

  private getTopicQueueOrThrow(topic: string) {
    const tq = this.getTopicQueue(topic)
    if (!tq) throw new Error(`No topic queue: ${topic}`)
    return tq
  }
}

export default SqlMessageQueue

class TopicQueue<T extends string = string> {
  private cursorExists = false
  private ensureCaughtUpTimeout: ReturnType<typeof setTimeout> | undefined
  private listeners: Listener<MessageOfType<T>>[] = []
  public processingQueue: PQueue | null = new PQueue({ concurrency: 1 }) // null during teardown

  constructor(
    private parent: SqlMessageQueue,
    private db: Database,
    public topic: T,
  ) {
    this.ensureCaughtUp()
  }

  listen(listenable: Listenable<MessageOfType<T>>) {
    this.listeners.push(listenable.listener)
  }

  private async ensureCursor(tx: Database): Promise<void> {
    if (this.cursorExists) return
    const anyCursor = tx.db
      .selectFrom('message_queue_cursor')
      .where('consumer', '=', this.parent.name)
      .where('topic', '=', ANY_TOPIC)
    await tx.db
      .insertInto('message_queue_cursor')
      .values({
        consumer: this.parent.name,
        topic: this.topic,
        cursor: sql`coalesce(${anyCursor.select('cursor')}, 1)`,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    this.cursorExists = true
  }

  async ensureCaughtUp(): Promise<void> {
    try {
      await this.processAll()
    } catch (err) {
      log.error({ err }, 'error ensuring queue is up to date')
    }
    this.ensureCaughtUpTimeout = setTimeout(() => this.ensureCaughtUp(), 60000) // 1 min
  }

  async destroy() {
    clearTimeout(this.ensureCaughtUpTimeout)
    const processingQueue = this.processingQueue
    this.processingQueue = null // Stop accepting new items
    processingQueue?.pause() // Stop processing items
    processingQueue?.clear() // Clear unprocessed items
    await processingQueue?.onIdle() // Complete in-process items
  }

  async processNext(): Promise<void> {
    await this.processingQueue?.add(() => this.processBatch(1))
  }

  async processAll(): Promise<void> {
    await this.processingQueue?.add(() => this.processBatch('all'))
  }

  /*
   * There are two kinds of cursors: the *-cursor or "any" cursor, and cursors for specific topics.
   * We need to ensure that the messages in a topic are processed in order, one at a time.
   *
   * When processing a *-cursor:
   * a. Lock every cursor, since this cursor could process messages in any topic.
   * b. Lookup the lowest unprocessed messages. That would be messages that are either unprocessed by their
   *    topic's cursor, or if their topic doesn't have a cursor, are unprocessed by the *-cursor.
   * c. Process messages in order, lowest first.
   * d. Move all cursors forward: we just processed the lowest unprocessed messages across any topic.
   *
   * When processing a topic-cursor:
   * a. Lock the topic's cursor and the *-cursor: these are the only cursors that may process messages from the topic.
   * b. Lookup the lowest unprocessed messages within the topic.
   * c. Process messages in order, lowest first.
   * d. Move topic's cursor forward.
   */
  private async processBatch(count: number | 'all'): Promise<void> {
    await this.db.transaction(async (dbTxn) => {
      await this.ensureCursor(dbTxn)

      let anyCursor: MessageQueueCursor | undefined
      if (this.db.dialect !== 'sqlite') {
        // Lock relevant cursors
        const cursors = await dbTxn.db
          .selectFrom('message_queue_cursor')
          .selectAll()
          .forUpdate()
          .where('consumer', '=', this.parent.name)
          .if(this.topic !== ANY_TOPIC, (qb) =>
            qb.where('topic', 'in', [this.topic, ANY_TOPIC]),
          )
          .execute()
        anyCursor = cursors.find((c) => c.topic === ANY_TOPIC)
      } else {
        anyCursor = await dbTxn.db
          .selectFrom('message_queue_cursor')
          .selectAll()
          .where('consumer', '=', this.parent.name)
          .where('topic', '=', ANY_TOPIC)
          .executeTakeFirst()
      }

      let builder = dbTxn.db
        .selectFrom('message_queue as message')
        .leftJoin('message_queue_cursor as cursor', (join) =>
          join
            .on('cursor.consumer', '=', this.parent.name)
            .onRef('cursor.topic', '=', 'message.topic'),
        )
        .if(this.topic !== ANY_TOPIC, (qb) =>
          qb.where('message.topic', '=', this.topic),
        )
        .where((qb) => {
          if (this.topic !== ANY_TOPIC || anyCursor === undefined) {
            // Processing a specific topic.
            // Topic cursor exists but not processed by it:
            return qb.whereRef('message.id', '>=', 'cursor.cursor')
          }
          // Processing any topic.
          const anyCursorValue = anyCursor.cursor
          return (
            qb
              // Topic cursor exists and message not processed by it:
              .whereRef('message.id', '>=', 'cursor.cursor')
              // Topic cursor doesn't exist and not processed by *-cursor:
              .orWhere((q) =>
                q
                  .where('cursor.cursor', 'is', null)
                  .where('message.id', '>=', anyCursorValue),
              )
          )
        })
        .orderBy('id', 'asc')
        .selectAll()

      if (count !== 'all') {
        builder = builder.limit(count)
      }

      const res = await builder.execute()
      const lastResult = res.at(-1)

      // all caught up
      if (!lastResult) return

      for (const row of res) {
        const message: MessageOfType = JSON.parse(row.message)
        await this.handleMessage(dbTxn, message)
      }

      const nextCursor = lastResult.id + 1
      // If processed a specific topic, update its cursor.
      // If processed *-topic, update all cursors.
      // Don't allow cursors to ever move backwards.
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('cursor', '<', nextCursor)
        .where('consumer', '=', this.parent.name)
        .if(this.topic !== ANY_TOPIC, (qb) =>
          qb.where('topic', '=', this.topic),
        )
        .execute()
    })
  }

  private async handleMessage(db: Database, message: MessageOfType) {
    if (this.topic === ANY_TOPIC) {
      for (const listener of this.listeners as Listener[]) {
        try {
          const effects = await listener({ message, db })
          await this.parent.send(db, effects ?? [])
        } catch (err) {
          log.error({ message, err }, `unable to handle event: ${message.type}`)
        }
      }
    } else {
      if (!isMessageOfType(message, this.topic)) {
        return log.error(
          { message },
          `message type does not match topic "${this.topic}": ${message.type}`,
        )
      }
      for (const listener of this.listeners) {
        try {
          const effects = await listener({ message, db })
          await this.parent.send(db, effects ?? [])
        } catch (err) {
          log.error({ message, err }, `unable to handle event: ${message.type}`)
        }
      }
    }
  }
}

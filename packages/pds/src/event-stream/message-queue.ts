import PQueue from 'p-queue'
import Database from '../db'
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
  private topicQueues: Map<string, TopicQueue> = new Map()

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

  private async ensureCursor(): Promise<void> {
    if (this.cursorExists) return
    await this.db.db
      .insertInto('message_queue_cursor')
      .values({ consumer: this.parent.name, topic: this.topic, cursor: 1 })
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

  private async processBatch(count: number | 'all'): Promise<void> {
    // TODO assuming topic is '*'
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let eligibleCursors = dbTxn.db
        .selectFrom('message_queue_cursor')
        .where('consumer', '=', this.parent.name)
      if (this.topic !== ANY_TOPIC) {
        eligibleCursors = eligibleCursors.where('topic', '=', this.topic)
      }

      const maybeAnyCursor = eligibleCursors.where('topic', '=', ANY_TOPIC)

      if (this.db.dialect !== 'sqlite') {
        eligibleCursors = eligibleCursors.forUpdate()
      }

      let builder = dbTxn.db
        .selectFrom('message_queue as message')
        .leftJoin(
          eligibleCursors.selectAll().as('cursor'),
          'cursor.topic',
          'message.topic',
        )
        .where((qb) => {
          return (
            qb
              // Topic cursor exists but not processed by it
              .where((q) => q.whereRef('message.id', '>=', 'cursor.cursor'))
              // Topic cursor doesn't exist and not processed by *-cursor (if *-cursor is eligible)
              .orWhere((q) =>
                q
                  .where('cursor.cursor', 'is', null)
                  .whereRef(
                    'message.id',
                    '>=',
                    maybeAnyCursor.select('cursor'),
                  ),
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
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('consumer', '=', this.parent.name)
        .where('topic', '=', this.topic)
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

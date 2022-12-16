import PQueue from 'p-queue'
import Database from '../db'
import { dbLogger as log } from '../logger'
import {
  MessageQueue,
  Listenable,
  Listener,
  MessageOfType,
  isMessageOfType,
} from './types'

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

  listen<T extends string, M extends MessageOfType<T>>(
    topic: T,
    listenable: Listenable<M>,
  ) {
    const topicQueue =
      this.topicQueues.get(topic) ?? new TopicQueue(this, this.db, topic)
    topicQueue.listen(listenable as Listenable) // @TODO avoid upcast
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
    return this.topicQueues.has(topic)
  }

  private getTopicQueue(topic: string) {
    return this.topicQueues.get(topic)
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
  public processingQueue: PQueue | null // null during teardown

  constructor(
    private parent: SqlMessageQueue,
    private db: Database,
    public topic: T,
  ) {
    this.ensureCaughtUp()
    this.processingQueue = new PQueue({ concurrency: 1 })
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

  async processAll(): Promise<void> {
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue_cursor as cursor')
        .innerJoin('message_queue', (join) =>
          join
            .onRef('cursor.topic', '=', 'message_queue.topic')
            .onRef('cursor.cursor', '<=', 'message_queue.id'),
        )
        .where('cursor.consumer', '=', this.parent.name)
        .where('cursor.topic', '=', this.topic)
        .orderBy('id', 'asc')
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
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

  async processNext(): Promise<void> {
    await this.processingQueue?.add(() => this.processNextConcurrent())
  }

  private async processNextConcurrent(): Promise<void> {
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue_cursor as cursor')
        .innerJoin('message_queue', (join) =>
          join
            .onRef('cursor.topic', '=', 'message_queue.topic')
            .onRef('cursor.cursor', '<=', 'message_queue.id'),
        )
        .where('cursor.consumer', '=', this.parent.name)
        .where('cursor.topic', '=', this.topic)
        .orderBy('id', 'asc')
        .limit(1)
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
      }

      // @NOTE this will block until in-flight messages are processed, and will be
      // holding onto resources in the meantime e.g. a db connection from the pool.
      const res = await builder.executeTakeFirst()

      // all caught up
      if (!res) return

      const message: MessageOfType = JSON.parse(res.message)
      await this.handleMessage(dbTxn, message)

      const nextCursor = res.id + 1
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('consumer', '=', this.parent.name)
        .where('topic', '=', this.topic)
        .returningAll()
        .execute()
    })
  }

  private async handleMessage(db: Database, message: MessageOfType) {
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

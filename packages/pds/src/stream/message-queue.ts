import Database from '../db'
import { dbLogger as log } from '../logger'
import { MessageQueue, Listenable, Listener, MessageOfType } from './types'

export class SqlMessageQueue implements MessageQueue {
  private cursorExists = false
  private ensureCaughtUpTimeout: ReturnType<typeof setTimeout> | undefined
  private listeners: Map<string, Listener[]> = new Map()

  constructor(private name: string, private db: Database) {
    this.ensureCaughtUp()
  }

  async send(
    tx: Database,
    messages: MessageOfType | MessageOfType[],
  ): Promise<void> {
    const msgArray = Array.isArray(messages) ? messages : [messages]
    if (msgArray.length === 0) return
    const now = new Date().toISOString()
    const values = msgArray.map((msg) => ({
      message: JSON.stringify(msg),
      createdAt: now,
    }))

    await tx.db.insertInto('message_queue').values(values).execute()
    for (let i = 0; i < msgArray.length; i++) {
      this.processNext().catch((err) => {
        log.error({ err }, 'error processing message')
      })
    }
  }

  listen<T extends string, M extends MessageOfType<T>>(
    topic: T,
    listenable: Listenable<M>,
  ) {
    const listeners = this.listeners.get(topic) ?? []
    listeners.push(listenable.listener as Listener) // @TODO avoid upcast
    this.listeners.set(topic, listeners)
  }

  private async ensureCursor(): Promise<void> {
    if (this.cursorExists) return
    await this.db.db
      .insertInto('message_queue_cursor')
      .values({ consumer: this.name, cursor: 1 })
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

  destroy() {
    if (this.ensureCaughtUpTimeout) {
      clearTimeout(this.ensureCaughtUpTimeout)
    }
  }

  async processAll(): Promise<void> {
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue_cursor as cursor')
        .innerJoin('message_queue', (join) =>
          join.onRef('cursor.cursor', '<=', 'message_queue.id'),
        )
        .where('cursor.consumer', '=', this.name)
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
      }
      const res = await builder.execute()
      // all caught up
      if (res.length === 0) return

      for (const row of res) {
        const message: MessageOfType = JSON.parse(row.message)
        await this.handleMessage(dbTxn, message)
      }
      const nextCursor = res[res.length - 1].id + 1
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('consumer', '=', this.name)
        .execute()
    })
  }

  async processNext(): Promise<void> {
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue_cursor as cursor')
        .innerJoin('message_queue', (join) =>
          join.onRef('cursor.cursor', '<=', 'message_queue.id'),
        )
        .where('cursor.consumer', '=', this.name)
        .orderBy('id', 'asc')
        .limit(1)
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
      }

      const res = await builder.executeTakeFirst()
      // all caught up
      if (!res) return

      const message: MessageOfType = JSON.parse(res.message)
      await this.handleMessage(dbTxn, message)

      const nextCursor = res.id + 1
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('consumer', '=', this.name)
        .returningAll()
        .execute()
    })
  }

  private async handleMessage(db: Database, message: MessageOfType) {
    const listeners = this.listeners.get(message.type)
    if (!listeners?.length) {
      return log.error({ message }, `no listeners for event: ${message.type}`)
    }
    for (const listener of listeners) {
      try {
        await listener({ message, db }) // @TODO returned side effects
      } catch (err) {
        log.error({ message, err }, `unable to handle event: ${message.type}`)
      }
    }
  }
}

export default SqlMessageQueue

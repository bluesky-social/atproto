import Database from '../db'
import { dbLogger as log } from '../logger'
import { MessageQueue, Listenable, Listener, MessageOfType } from './types'

// @NOTE A message dispatcher for loose coupling within db transactions.
// Messages are handled immediately. This should not be around for long.
export class MessageDispatcher implements MessageQueue {
  private destroyed = false
  private listeners: Map<string, Listener[]> = new Map()

  async send(
    tx: Database,
    message: MessageOfType | MessageOfType[],
  ): Promise<void> {
    if (this.destroyed) return
    const messages = Array.isArray(message) ? message : [message]
    for (const msg of messages) {
      await this.handleMessage(tx, msg)
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

  destroy(): void {
    this.destroyed = true
  }

  private async handleMessage(db: Database, message: MessageOfType) {
    const listeners = this.listeners.get(message.type)
    if (!listeners?.length) {
      return log.error({ message }, `no listeners for event: ${message.type}`)
    }
    for (const listener of listeners) {
      await listener({ message, db })
    }
  }

  // Unused by MessageDispatcher
  async processNext(): Promise<void> {}
  async processAll(): Promise<void> {}
}

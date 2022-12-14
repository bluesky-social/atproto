import Database from '../db'

export type MessageOfType<T extends string = string> = {
  type: T
  [s: string]: unknown
}

export type Listener<M extends MessageOfType = MessageOfType> = (ctx: {
  message: M
  db: Database
}) => Promise<void | MessageOfType[]>

export interface Listenable<M extends MessageOfType = MessageOfType> {
  listener: Listener<M>
}

export abstract class Consumer<M extends MessageOfType>
  implements Listenable<M>
{
  abstract dispatch(ctx: {
    db: Database
    message: M
  }): Promise<void | MessageOfType[]>
  get listener() {
    return this.dispatch.bind(this)
  }
}

export interface MessageQueue {
  send(tx: Database, message: MessageOfType | MessageOfType[]): Promise<void>
  listen<T extends string, M extends MessageOfType<T>>(
    topic: T,
    listenable: Listenable<M>,
  ): void
  processNext(): Promise<void>
  processAll(): Promise<void>
  destroy(): void
}

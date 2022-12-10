import Database from '../db'

export type MessageOfType<T extends string = string> = {
  type: T
  [s: string]: unknown
}

export type Listener<M extends MessageOfType = MessageOfType> = (ctx: {
  db: Database
  message: M
}) => Promise<void | MessageOfType[]>

export type Listenable<M extends MessageOfType = MessageOfType> =
  | Listener<M>
  | { listener: Listener<M> }

export abstract class Consumer<M extends MessageOfType> {
  abstract dispatch(ctx: {
    db: Database
    message: M
  }): Promise<void | MessageOfType[]>
  get listener() {
    return this.dispatch.bind(this)
  }
}

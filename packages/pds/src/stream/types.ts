import Database from '../db'

// @TODO tidy Message vs BaseMessage
export type BaseMessage<T extends string = string> = {
  type: T
  [s: string]: unknown
}

export type Listener<M extends BaseMessage = BaseMessage> = (ctx: {
  db: Database
  message: M
}) => Promise<void | BaseMessage[]>

export abstract class Consumer<M extends BaseMessage> {
  abstract dispatch(ctx: {
    db: Database
    message: M
  }): Promise<void | BaseMessage[]>
  get listener() {
    return this.dispatch.bind(this)
  }
}

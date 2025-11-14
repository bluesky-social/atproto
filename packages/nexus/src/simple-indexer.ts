import { HandlerOpts, NexusHandler } from './channel'
import { NexusEvent, RecordEvent, UserEvent } from './events'

type UserEventHandler = (evt: UserEvent, opts?: HandlerOpts) => Promise<void>
type RecordEventHandler = (
  evt: RecordEvent,
  opts?: HandlerOpts,
) => Promise<void>
type ErrorHandler = (err: Error) => void

export class SimpleIndexer implements NexusHandler {
  private userHandler: UserEventHandler | undefined
  private recordHandler: RecordEventHandler | undefined
  private errorHandler: ErrorHandler | undefined

  user(fn: UserEventHandler) {
    this.userHandler = fn
  }

  record(fn: RecordEventHandler) {
    this.recordHandler = fn
  }

  error(fn: ErrorHandler) {
    this.errorHandler = fn
  }

  async onEvent(evt: NexusEvent, opts?: HandlerOpts): Promise<void> {
    if (evt.type === 'record') {
      this.recordHandler?.(evt, opts)
    } else {
      return this.userHandler?.(evt, opts)
    }
  }

  onError(err: Error) {
    if (this.errorHandler) {
      this.errorHandler(err)
    } else {
      throw err
    }
  }
}

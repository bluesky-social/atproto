import { HandlerOpts, NexusHandlers } from './channel'
import { NexusEvent, RecordEvent, UserEvent } from './events'

type UserEvtHandler = (evt: UserEvent, opts?: HandlerOpts) => Promise<void>
type RecordEvtHandler = (evt: RecordEvent, opts?: HandlerOpts) => Promise<void>
type ErrorHandler = (err: Error) => void

export class SimpleRouter implements NexusHandlers {
  private userHandler: UserEvtHandler | undefined
  private recordHandler: RecordEvtHandler | undefined
  private errorHandler: ErrorHandler | undefined

  user(fn: UserEvtHandler) {
    this.userHandler = fn
  }

  record(fn: RecordEvtHandler) {
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

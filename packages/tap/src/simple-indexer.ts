import { HandlerOpts, TapHandler } from './channel'
import { TapEvent, RecordEvent, IdentityEvent } from './events'

type IdentityEventHandler = (
  evt: IdentityEvent,
  opts?: HandlerOpts,
) => Promise<void>
type RecordEventHandler = (
  evt: RecordEvent,
  opts?: HandlerOpts,
) => Promise<void>
type ErrorHandler = (err: Error) => void

export class SimpleIndexer implements TapHandler {
  private identityHandler: IdentityEventHandler | undefined
  private recordHandler: RecordEventHandler | undefined
  private errorHandler: ErrorHandler | undefined

  identity(fn: IdentityEventHandler) {
    this.identityHandler = fn
  }

  record(fn: RecordEventHandler) {
    this.recordHandler = fn
  }

  error(fn: ErrorHandler) {
    this.errorHandler = fn
  }

  async onEvent(evt: TapEvent, opts?: HandlerOpts): Promise<void> {
    if (evt.type === 'record') {
      return this.recordHandler?.(evt, opts)
    } else {
      return this.identityHandler?.(evt, opts)
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

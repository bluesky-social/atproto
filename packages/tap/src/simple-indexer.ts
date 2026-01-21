import { HandlerOpts, TapHandler } from './channel'
import { IdentityEvent, RecordEvent, TapEvent } from './types'

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

  identity(fn: IdentityEventHandler): this {
    this.identityHandler = fn
    return this
  }

  record(fn: RecordEventHandler): this {
    this.recordHandler = fn
    return this
  }

  error(fn: ErrorHandler): this {
    this.errorHandler = fn
    return this
  }

  async onEvent(evt: TapEvent, opts: HandlerOpts): Promise<void> {
    if (evt.type === 'record') {
      await this.recordHandler?.(evt, opts)
    } else {
      await this.identityHandler?.(evt, opts)
    }
    await opts.ack()
  }

  onError(err: Error) {
    if (this.errorHandler) {
      this.errorHandler(err)
    } else {
      throw err
    }
  }
}

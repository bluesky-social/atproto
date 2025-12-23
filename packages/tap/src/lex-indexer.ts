import { Infer, RecordSchema } from '@atproto/lex-schema'
import { HandlerOpts, TapHandler } from './channel'
import { IdentityEvent, RecordEvent, TapEvent } from './types'

export type Namespace<T> = T | { main: T }

export function getMain<T extends object>(ns: Namespace<T>): T {
  return 'main' in ns ? ns.main : ns
}

type BaseRecordEvent = Omit<RecordEvent, 'record' | 'action' | 'cid'>

export type CreateEvent<R> = BaseRecordEvent & {
  action: 'create'
  record: R
  cid: string
}

export type UpdateEvent<R> = BaseRecordEvent & {
  action: 'update'
  record: R
  cid: string
}

export type PutEvent<R> = BaseRecordEvent & {
  action: 'create' | 'update'
  record: R
  cid: string
}

export type DeleteEvent = BaseRecordEvent & {
  action: 'delete'
}

export type CreateHandler<R> = (
  evt: CreateEvent<R>,
  opts: HandlerOpts,
) => Promise<void>

export type UpdateHandler<R> = (
  evt: UpdateEvent<R>,
  opts: HandlerOpts,
) => Promise<void>

export type PutHandler<R> = (
  evt: PutEvent<R>,
  opts: HandlerOpts,
) => Promise<void>

export type DeleteHandler = (
  evt: DeleteEvent,
  opts: HandlerOpts,
) => Promise<void>

export type IdentityHandler = (
  evt: IdentityEvent,
  opts: HandlerOpts,
) => Promise<void>

export type ErrorHandler = (err: Error) => void

export interface LexIndexerOptions {
  validate?: boolean
  skipUnhandled?: boolean
}

interface RegisteredHandler {
  schema: RecordSchema
  handler: (evt: unknown, opts: HandlerOpts) => Promise<void>
}

export class LexIndexer implements TapHandler {
  private handlers = new Map<string, RegisteredHandler>()
  private identityHandler: IdentityHandler | undefined
  private errorHandler: ErrorHandler | undefined
  private options: Required<LexIndexerOptions>

  constructor(options: LexIndexerOptions = {}) {
    this.options = {
      validate: options.validate ?? false,
      skipUnhandled: options.skipUnhandled ?? true,
    }
  }

  private register(
    nsid: string,
    action: string,
    schema: RecordSchema,
    handler: (evt: unknown, opts: HandlerOpts) => Promise<void>,
  ): void {
    const key = `${nsid}:${action}`
    if (this.handlers.has(key)) {
      throw new Error(`Handler already registered for ${key}`)
    }
    this.handlers.set(key, { schema, handler })
  }

  create<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: CreateHandler<Infer<T>>,
  ): this {
    const schema = getMain(ns)
    this.register(schema.$type, 'create', schema, handler as any)
    return this
  }

  update<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: UpdateHandler<Infer<T>>,
  ): this {
    const schema = getMain(ns)
    this.register(schema.$type, 'update', schema, handler as any)
    return this
  }

  delete<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: DeleteHandler,
  ): this {
    const schema = getMain(ns)
    this.register(schema.$type, 'delete', schema, handler as any)
    return this
  }

  // handles both create and update
  put<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: PutHandler<Infer<T>>,
  ): this {
    const schema = getMain(ns)
    this.register(schema.$type, 'put', schema, handler as any)
    return this
  }

  identity(fn: IdentityHandler): this {
    this.identityHandler = fn
    return this
  }

  error(fn: ErrorHandler): this {
    this.errorHandler = fn
    return this
  }

  async onEvent(evt: TapEvent, opts: HandlerOpts): Promise<void> {
    if (evt.type === 'identity') {
      await this.identityHandler?.(evt, opts)
    } else {
      await this.handleRecordEvent(evt, opts)
    }
    await opts.ack()
  }

  private async handleRecordEvent(
    evt: RecordEvent,
    opts: HandlerOpts,
  ): Promise<void> {
    const { collection, action } = evt

    let registered = this.handlers.get(`${collection}:${action}`)
    if (!registered && (action === 'create' || action === 'update')) {
      registered = this.handlers.get(`${collection}:put`)
    }

    if (!registered) {
      if (!this.options.skipUnhandled) {
        throw new Error(`No handler registered for ${collection}:${action}`)
      }
      return
    }

    if (this.options.validate && action !== 'delete' && evt.record) {
      const result = registered.schema.safeParse(evt.record)
      if (!result.success) {
        throw new Error(
          `Record validation failed for ${collection}: ${result.reason}`,
        )
      }
    }

    await registered.handler(evt, opts)
  }

  onError(err: Error): void {
    if (this.errorHandler) {
      this.errorHandler(err)
    } else {
      throw err
    }
  }
}

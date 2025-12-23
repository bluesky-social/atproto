import { Infer, Namespace, RecordSchema, getMain } from '@atproto/lex'
import { HandlerOpts, TapHandler } from './channel'
import { IdentityEvent, RecordEvent, TapEvent } from './types'

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

export type OtherHandler = (
  evt: RecordEvent,
  opts: HandlerOpts,
) => Promise<void>

export type IdentityHandler = (
  evt: IdentityEvent,
  opts: HandlerOpts,
) => Promise<void>

export type ErrorHandler = (err: Error) => void

interface RegisteredHandler {
  schema: RecordSchema
  handler: (evt: unknown, opts: HandlerOpts) => Promise<void>
}

export class LexIndexer implements TapHandler {
  private handlers = new Map<string, RegisteredHandler>()
  private otherHandler: OtherHandler | undefined
  private identityHandler: IdentityHandler | undefined
  private errorHandler: ErrorHandler | undefined

  private handlerKey(collection: string, action: string): string {
    return `${collection}:${action}`
  }

  private register<const T extends RecordSchema>(
    action: string,
    ns: Namespace<T>,
    handler: (evt: unknown, opts: HandlerOpts) => Promise<void>,
  ): this {
    const schema = getMain(ns)
    const key = this.handlerKey(schema.$type, action)
    if (this.handlers.has(key)) {
      throw new Error(`Handler already registered for ${key}`)
    }
    this.handlers.set(key, { schema, handler })
    return this
  }

  create<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: CreateHandler<Infer<T>>,
  ): this {
    return this.register('create', ns, handler as any)
  }

  update<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: UpdateHandler<Infer<T>>,
  ): this {
    return this.register('update', ns, handler as any)
  }

  delete<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: DeleteHandler,
  ): this {
    return this.register('delete', ns, handler as any)
  }

  // handles both create and update
  put<const T extends RecordSchema>(
    ns: Namespace<T>,
    handler: PutHandler<Infer<T>>,
  ): this {
    this.register('create', ns, handler as any)
    return this.register('update', ns, handler as any)
  }

  other(fn: OtherHandler): this {
    this.otherHandler = fn
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
    const key = this.handlerKey(collection, action)
    const registered = this.handlers.get(key)

    if (!registered) {
      await this.otherHandler?.(evt, opts)
      return
    }

    if (action === 'create' || action === 'update') {
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

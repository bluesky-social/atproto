import { Infer, Main, RecordSchema, getMain } from '@atproto/lex'
import { AtUriString, NsidString } from '@atproto/syntax'
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

export type PutEvent<R> = CreateEvent<R> | UpdateEvent<R>

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

export type UntypedHandler = (
  evt: RecordEvent,
  opts: HandlerOpts,
) => Promise<void>

export type IdentityHandler = (
  evt: IdentityEvent,
  opts: HandlerOpts,
) => Promise<void>

export type ErrorHandler = (err: Error) => void

export type RecordHandler<R> =
  | CreateHandler<R>
  | UpdateHandler<R>
  | PutHandler<R>
  | DeleteHandler

interface RegisteredHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: RecordHandler<any>
  schema: RecordSchema
}

export class LexIndexer implements TapHandler {
  private handlers = new Map<string, RegisteredHandler>()
  private otherHandler: UntypedHandler | undefined
  private identityHandler: IdentityHandler | undefined
  private errorHandler: ErrorHandler | undefined

  private handlerKey(
    collection: NsidString,
    action: RecordEvent['action'],
  ): string {
    return `${collection}:${action}`
  }

  private register<const T extends RecordSchema>(
    action: RecordEvent['action'],
    ns: Main<T>,
    handler: RecordHandler<Infer<T>>,
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
    ns: Main<T>,
    handler: CreateHandler<Infer<T>>,
  ): this {
    return this.register('create', ns, handler)
  }

  update<const T extends RecordSchema>(
    ns: Main<T>,
    handler: UpdateHandler<Infer<T>>,
  ): this {
    return this.register('update', ns, handler)
  }

  delete<const T extends RecordSchema>(
    ns: Main<T>,
    handler: DeleteHandler,
  ): this {
    return this.register('delete', ns, handler)
  }

  put<const T extends RecordSchema>(
    ns: Main<T>,
    handler: PutHandler<Infer<T>>,
  ): this {
    this.register('create', ns, handler)
    this.register('update', ns, handler)
    return this
  }

  other(fn: UntypedHandler): this {
    if (this.otherHandler) {
      throw new Error(`Handler already registered for "other"`)
    }
    this.otherHandler = fn
    return this
  }

  identity(fn: IdentityHandler): this {
    if (this.identityHandler) {
      throw new Error(`Handler already registered for "identity"`)
    }
    this.identityHandler = fn
    return this
  }

  error(fn: ErrorHandler): this {
    if (this.errorHandler) {
      throw new Error(`Handler already registered for "error"`)
    }
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
      const match = registered.schema.safeValidate(evt.record)
      if (!match.success) {
        const uriStr: AtUriString = `at://${evt.did}/${evt.collection}/${evt.rkey}`
        throw new Error(`Record validation failed for ${uriStr}`, {
          cause: match.reason,
        })
      }
    }

    await (registered.handler as UntypedHandler)(evt, opts)
  }

  onError(err: Error): void {
    if (this.errorHandler) {
      this.errorHandler(err)
    } else {
      throw err
    }
  }
}

import {
  $Typed,
  InferInput,
  Main,
  RecordSchema,
  Restricted,
  getMain,
} from '@atproto/lex-schema'
import { com } from './lexicons/index.js'
import {
  RecordKeyOptions,
  getDefaultRecordKey,
  getLiteralRecordKey,
} from './util.js'

export type ApplyWritesCreateOptions<T extends RecordSchema> = RecordKeyOptions<
  T,
  'tid' | 'any'
>

export type ApplyWritesUpdateOptions<T extends RecordSchema> =
  RecordKeyOptions<T>

export type ApplyWritesDeleteOptions<T extends RecordSchema> =
  RecordKeyOptions<T>

export class ApplyWritesOperations {
  public writes: Array<
    | $Typed<com.atproto.repo.applyWrites.Create>
    | $Typed<com.atproto.repo.applyWrites.Update>
    | $Typed<com.atproto.repo.applyWrites.Delete>
  > = []

  constructor(private readonly options?: { validateRequest?: boolean }) {}

  create<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends ApplyWritesCreateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<InferInput<T>, '$type'>,
  ): void
  create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: ApplyWritesCreateOptions<T>,
  ): void
  create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: ApplyWritesCreateOptions<T> = {} as ApplyWritesCreateOptions<T>,
  ): void {
    const schema: T = getMain(ns)
    const value = schema.build(input)
    if (this.options?.validateRequest) schema.validate(value)
    const op = com.atproto.repo.applyWrites.create.$build({
      collection: schema.$type,
      value,
      rkey: options.rkey ?? getDefaultRecordKey(schema),
    })
    this.writes.push(op)
  }

  update<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends ApplyWritesUpdateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<InferInput<T>, '$type'>,
  ): void
  update<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: ApplyWritesUpdateOptions<T>,
  ): void
  update<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: ApplyWritesUpdateOptions<T> = {} as ApplyWritesUpdateOptions<T>,
  ): void {
    const schema: T = getMain(ns)
    const value = schema.build(input)
    if (this.options?.validateRequest) schema.validate(value)
    const op = com.atproto.repo.applyWrites.update.$build({
      collection: schema.$type,
      value,
      rkey: options.rkey ?? getLiteralRecordKey(schema),
    })
    this.writes.push(op)
  }

  delete<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends ApplyWritesDeleteOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): void
  delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: ApplyWritesDeleteOptions<T>,
  ): void
  delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: ApplyWritesDeleteOptions<T> = {} as ApplyWritesDeleteOptions<T>,
  ): void {
    const schema: T = getMain(ns)
    const op = com.atproto.repo.applyWrites.delete.$build({
      collection: schema.$type,
      rkey: options.rkey ?? getLiteralRecordKey(schema),
    })
    this.writes.push(op)
  }
}

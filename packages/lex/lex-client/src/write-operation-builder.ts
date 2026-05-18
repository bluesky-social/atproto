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

export type WriteOperation =
  | $Typed<com.atproto.repo.applyWrites.Create>
  | $Typed<com.atproto.repo.applyWrites.Update>
  | $Typed<com.atproto.repo.applyWrites.Delete>

export type WriteOperationCreateOptions<T extends RecordSchema> =
  RecordKeyOptions<T, 'tid' | 'any'>

export type WriteOperationUpdateOptions<T extends RecordSchema> =
  RecordKeyOptions<T>

export type WriteOperationDeleteOptions<T extends RecordSchema> =
  RecordKeyOptions<T>

export type WriteOperationsFactory = (
  helper: WriteOperationHelper,
) => Iterable<WriteOperation>

export class WriteOperationHelper {
  private constructor() {}

  create<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends WriteOperationCreateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<InferInput<T>, '$type'>,
  ): $Typed<com.atproto.repo.applyWrites.Create>
  create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationCreateOptions<T>,
  ): $Typed<com.atproto.repo.applyWrites.Create>
  create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationCreateOptions<T> = {} as WriteOperationCreateOptions<T>,
  ): $Typed<com.atproto.repo.applyWrites.Create> {
    const schema: T = getMain(ns)
    const value = schema.build(input)
    return com.atproto.repo.applyWrites.create.$build({
      collection: schema.$type,
      value,
      rkey: options?.rkey ?? getDefaultRecordKey(schema),
    })
  }

  update<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends WriteOperationUpdateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<InferInput<T>, '$type'>,
  ): $Typed<com.atproto.repo.applyWrites.Update>
  update<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationUpdateOptions<T>,
  ): $Typed<com.atproto.repo.applyWrites.Update>
  update<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationUpdateOptions<T> = {} as WriteOperationUpdateOptions<T>,
  ): $Typed<com.atproto.repo.applyWrites.Update> {
    const schema: T = getMain(ns)
    const value = schema.build(input)
    return com.atproto.repo.applyWrites.update.$build({
      collection: schema.$type,
      value,
      rkey: options?.rkey ?? getLiteralRecordKey(schema),
    })
  }

  delete<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends WriteOperationDeleteOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): $Typed<com.atproto.repo.applyWrites.Delete>
  delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: WriteOperationDeleteOptions<T>,
  ): $Typed<com.atproto.repo.applyWrites.Delete>
  delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: WriteOperationDeleteOptions<T> = {} as WriteOperationDeleteOptions<T>,
  ): $Typed<com.atproto.repo.applyWrites.Delete> {
    const schema: T = getMain(ns)
    return com.atproto.repo.applyWrites.delete.$build({
      collection: schema.$type,
      rkey: options?.rkey ?? getLiteralRecordKey(schema),
    })
  }

  static build(factory: WriteOperationsFactory): WriteOperation[] {
    return Array.from(factory(new WriteOperationHelper()))
  }
}

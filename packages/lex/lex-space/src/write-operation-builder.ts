import {
  type WriteOperationCreateOptions,
  type WriteOperationDeleteOptions,
  type WriteOperationUpdateOptions,
  getDefaultRecordKey,
  getLiteralRecordKey,
} from '@atproto/lex-client'
import {
  type $Typed,
  type InferInput,
  type Main,
  type RecordSchema,
  type Restricted,
  getMain,
} from '@atproto/lex-schema'
import { com } from './lexicons/index.js'

export declare namespace SpaceWriteOperationHelper {
  export type Operation =
    | $Typed<com.atproto.space.applyWrites.Create>
    | $Typed<com.atproto.space.applyWrites.Update>
    | $Typed<com.atproto.space.applyWrites.Delete>

  export type Factory = (
    helper: SpaceWriteOperationHelper,
  ) => Iterable<Operation>
}

/**
 * Builds the operations of a {@link SpaceClient.applyWrites} batch. Same as
 * `WriteOperationHelper` from `@atproto/lex-client`, for space repos.
 */
export class SpaceWriteOperationHelper {
  private constructor() {}

  create<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends WriteOperationCreateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<InferInput<T>, '$type'>,
  ): $Typed<com.atproto.space.applyWrites.Create>
  create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationCreateOptions<T>,
  ): $Typed<com.atproto.space.applyWrites.Create>
  create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationCreateOptions<T> = {} as WriteOperationCreateOptions<T>,
  ): $Typed<com.atproto.space.applyWrites.Create> {
    const schema: T = getMain(ns)
    return com.atproto.space.applyWrites.create.$build({
      collection: schema.$type,
      value: schema.build(input),
      rkey: options?.rkey ?? getDefaultRecordKey(schema),
    })
  }

  update<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends WriteOperationUpdateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<InferInput<T>, '$type'>,
  ): $Typed<com.atproto.space.applyWrites.Update>
  update<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationUpdateOptions<T>,
  ): $Typed<com.atproto.space.applyWrites.Update>
  update<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<InferInput<T>, '$type'>,
    options: WriteOperationUpdateOptions<T> = {} as WriteOperationUpdateOptions<T>,
  ): $Typed<com.atproto.space.applyWrites.Update> {
    const schema: T = getMain(ns)
    return com.atproto.space.applyWrites.update.$build({
      collection: schema.$type,
      value: schema.build(input),
      rkey: options?.rkey ?? getLiteralRecordKey(schema),
    })
  }

  delete<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends WriteOperationDeleteOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): $Typed<com.atproto.space.applyWrites.Delete>
  delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: WriteOperationDeleteOptions<T>,
  ): $Typed<com.atproto.space.applyWrites.Delete>
  delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: WriteOperationDeleteOptions<T> = {} as WriteOperationDeleteOptions<T>,
  ): $Typed<com.atproto.space.applyWrites.Delete> {
    const schema: T = getMain(ns)
    return com.atproto.space.applyWrites.delete.$build({
      collection: schema.$type,
      rkey: options?.rkey ?? getLiteralRecordKey(schema),
    })
  }

  static build(
    factory: SpaceWriteOperationHelper.Factory,
  ): SpaceWriteOperationHelper.Operation[] {
    return Array.from(factory(new SpaceWriteOperationHelper()))
  }
}

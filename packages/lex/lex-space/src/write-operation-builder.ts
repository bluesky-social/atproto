import {
  type WriteOperationCreateOptions,
  type WriteOperationDeleteOptions,
  type WriteOperationUpdateOptions,
  rkeyFor,
  rkeyForCreate,
} from '@atproto/lex-client'
import type { TypedLexMap } from '@atproto/lex-data'
import type {
  $Typed,
  NsidString,
  RecordSchema,
  Restricted,
  Space,
} from '@atproto/lex-schema'
import { com } from './lexicons/index.js'
import type {
  SpaceCollection,
  SpaceRecordInput,
  SpaceRecordSchema,
} from './space-collection.js'

export declare namespace SpaceWriteOperationHelper {
  export type Operation =
    | $Typed<com.atproto.space.applyWrites.Create>
    | $Typed<com.atproto.space.applyWrites.Update>
    | $Typed<com.atproto.space.applyWrites.Delete>

  export type Factory<S extends Space = Space> = (
    helper: SpaceWriteOperationHelper<S>,
  ) => Iterable<Operation>
}

/**
 * Builds the operations of a {@link SpaceClient.applyWrites} batch, for the
 * collections declared by the space type `S`. Records are validated against
 * the space type's schema of their collection.
 */
export class SpaceWriteOperationHelper<S extends Space = Space> {
  private constructor(protected readonly space: S) {}

  create<R extends SpaceRecordInput<S>>(
    record: NonNullable<unknown> extends WriteOperationCreateOptions<
      SpaceRecordSchema<S, R['$type']>
    >
      ? R
      : Restricted<'This record type requires an "options" argument'>,
  ): $Typed<com.atproto.space.applyWrites.Create>
  create<R extends SpaceRecordInput<S>>(
    record: R,
    options: WriteOperationCreateOptions<SpaceRecordSchema<S, R['$type']>>,
  ): $Typed<com.atproto.space.applyWrites.Create>
  create(
    record: TypedLexMap<NsidString>,
    options: { rkey?: string } = {},
  ): $Typed<com.atproto.space.applyWrites.Create> {
    const schema: RecordSchema = this.getSchema(record.$type)
    return com.atproto.space.applyWrites.create.$build({
      collection: record.$type,
      value: schema.validate(record),
      rkey: rkeyForCreate(schema, options.rkey),
    })
  }

  update<R extends SpaceRecordInput<S>>(
    record: NonNullable<unknown> extends WriteOperationUpdateOptions<
      SpaceRecordSchema<S, R['$type']>
    >
      ? R
      : Restricted<'This record type requires an "options" argument'>,
  ): $Typed<com.atproto.space.applyWrites.Update>
  update<R extends SpaceRecordInput<S>>(
    record: R,
    options: WriteOperationUpdateOptions<SpaceRecordSchema<S, R['$type']>>,
  ): $Typed<com.atproto.space.applyWrites.Update>
  update(
    record: TypedLexMap<NsidString>,
    options: { rkey?: string } = {},
  ): $Typed<com.atproto.space.applyWrites.Update> {
    const schema: RecordSchema = this.getSchema(record.$type)
    return com.atproto.space.applyWrites.update.$build({
      collection: record.$type,
      value: schema.validate(record),
      rkey: rkeyFor(schema, options.rkey),
    })
  }

  delete<const C extends SpaceCollection<S>>(
    collection: NonNullable<unknown> extends WriteOperationDeleteOptions<
      SpaceRecordSchema<S, C>
    >
      ? C
      : Restricted<'This record type requires an "options" argument'>,
  ): $Typed<com.atproto.space.applyWrites.Delete>
  delete<const C extends SpaceCollection<S>>(
    collection: C,
    options: WriteOperationDeleteOptions<SpaceRecordSchema<S, C>>,
  ): $Typed<com.atproto.space.applyWrites.Delete>
  delete(
    collection: NsidString,
    options: { rkey?: string } = {},
  ): $Typed<com.atproto.space.applyWrites.Delete> {
    const schema: RecordSchema = this.getSchema(collection)
    return com.atproto.space.applyWrites.delete.$build({
      collection,
      rkey: rkeyFor(schema, options.rkey),
    })
  }

  /**
   * The space type's schema of `collection`.
   *
   * @throws {TypeError} if `collection` is not declared by the space type
   *
   * @example
   * ```typescript
   * await space.applyWrites((op) => {
   *   const post = op.getSchema('com.example.post')
   *   return texts.map((text) => op.create(post.$build({ text })))
   * })
   * ```
   */
  getSchema<const C extends SpaceCollection<S>>(
    collection: C,
  ): SpaceRecordSchema<S, C> {
    for (const c of this.space.collections) {
      if (c.$type === collection) return c as SpaceRecordSchema<S, C>
    }
    throw new TypeError(
      `${collection} is not a collection of ${this.space.spaceType} spaces`,
    )
  }

  static build<S extends Space>(
    space: S,
    factory: SpaceWriteOperationHelper.Factory<S>,
  ): SpaceWriteOperationHelper.Operation[] {
    return Array.from(factory(new SpaceWriteOperationHelper(space)))
  }
}

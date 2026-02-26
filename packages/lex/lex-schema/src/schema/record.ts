import {
  $Typed,
  $typed,
  InferInput,
  InferOutput,
  LexiconRecordKey,
  NsidString,
  Schema,
  TidString,
  Unknown$TypedObject,
  ValidationContext,
  Validator,
} from '../core.js'
import { literal } from './literal.js'
import { string } from './string.js'

/**
 * Infers the record key type from a RecordSchema.
 *
 * @template R - The RecordSchema type
 */
export type InferRecordKey<R extends RecordSchema> =
  R extends RecordSchema<infer TKey> ? RecordKeySchemaOutput<TKey> : never

export type TypedRecord<
  TType extends NsidString,
  TValue extends { $type?: unknown } = { $type?: unknown },
> = TValue extends { $type: TType }
  ? TValue
  : $Typed<Exclude<TValue, Unknown$TypedObject>, TType>

/**
 * Schema for AT Protocol records with a type identifier and key constraints.
 *
 * Records are the primary data unit in AT Protocol. Each record has a `$type`
 * field identifying its Lexicon schema, and is stored at a specific key
 * (TID, NSID, or other format) in a repository.
 *
 * @template TKey - The record key type ('tid', 'nsid', 'any', or 'literal:...')
 * @template TType - The NSID string identifying this record type
 * @template TShape - The validator type for the record's data shape
 *
 * @example
 * ```ts
 * const postSchema = new RecordSchema(
 *   'tid',
 *   'app.bsky.feed.post',
 *   l.object({ text: l.string(), createdAt: l.string() })
 * )
 * ```
 */
export class RecordSchema<
  const TKey extends LexiconRecordKey = any,
  const TType extends NsidString = any,
  const TShape extends Validator<{ [k: string]: unknown }> = any,
> extends Schema<
  $Typed<InferInput<TShape>, TType>,
  $Typed<InferOutput<TShape>, TType>
> {
  readonly type = 'record' as const

  keySchema: RecordKeySchema<TKey>

  constructor(
    readonly key: TKey,
    readonly $type: TType,
    readonly schema: TShape,
  ) {
    super()
    this.keySchema = recordKey(key)
  }

  isTypeOf<TValue extends { $type?: unknown }>(
    value: TValue,
  ): value is TypedRecord<TType, TValue> {
    return value.$type === this.$type
  }

  build(
    input: Omit<InferInput<this>, '$type'>,
  ): $Typed<InferOutput<this>, TType> {
    return this.parse($typed(input, this.$type))
  }

  $isTypeOf<TValue extends { $type?: unknown }>(
    value: TValue,
  ): value is TypedRecord<TType, TValue> {
    return this.isTypeOf<TValue>(value)
  }

  $build(
    input: Omit<InferInput<this>, '$type'>,
  ): $Typed<InferOutput<this>, TType> {
    return this.build(input)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const result = ctx.validate(input, this.schema)

    if (!result.success) {
      return result
    }

    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result
  }
}

export type RecordKeySchemaOutput<Key extends LexiconRecordKey> =
  Key extends 'any'
    ? string
    : Key extends 'tid'
      ? TidString
      : Key extends 'nsid'
        ? NsidString
        : Key extends `literal:${infer L extends string}`
          ? L
          : never

export type RecordKeySchema<Key extends LexiconRecordKey> = Schema<
  RecordKeySchemaOutput<Key>
>

const keySchema = string({ minLength: 1 })
const tidSchema = string({ format: 'tid' })
const nsidSchema = string({ format: 'nsid' })
const selfLiteralSchema = literal('self')

function recordKey<Key extends LexiconRecordKey>(
  key: Key,
): RecordKeySchema<Key> {
  // @NOTE Use cached instances for common schemas
  if (key === 'any') return keySchema as any
  if (key === 'tid') return tidSchema as any
  if (key === 'nsid') return nsidSchema as any
  if (key.startsWith('literal:')) {
    const value = key.slice(8) as RecordKeySchemaOutput<Key>
    if (value === 'self') return selfLiteralSchema as any
    return literal(value)
  }

  throw new Error(`Unsupported record key type: ${key}`)
}

/**
 * Ensures that a `$type` used in a record is a valid NSID (i.e. no fragment).
 */
type AsNsid<T> = T extends `${string}#${string}` ? never : T

/**
 * Creates a record schema for AT Protocol records.
 *
 * Records are the primary data unit in AT Protocol repositories. They have
 * a `$type` field identifying their Lexicon schema, and are stored at keys
 * following a specific format (TID, NSID, etc.).
 *
 * This function offers two overloads:
 * - One that infers the output type from the provided arguments (does not
 *   support circular references)
 * - One with an explicitly defined interface for use with codegen and
 *   circular references
 *
 * @param key - The record key type: 'tid', 'nsid', 'any', or 'literal:value'
 * @param type - The NSID identifying this record type (e.g., 'app.bsky.feed.post')
 * @param validator - Schema validator for the record's properties
 * @returns A new {@link RecordSchema} instance
 *
 * @example
 * ```ts
 * // Post record with TID key
 * const postSchema = l.record('tid', 'app.bsky.feed.post', l.object({
 *   text: l.string({ maxGraphemes: 300 }),
 *   createdAt: l.string({ format: 'datetime' }),
 *   reply: l.optional(l.object({
 *     root: l.ref(() => strongRefSchema),
 *     parent: l.ref(() => strongRefSchema),
 *   })),
 * }))
 *
 * // Profile record with literal 'self' key
 * const profileSchema = l.record('literal:self', 'app.bsky.actor.profile', l.object({
 *   displayName: l.optional(l.string({ maxGraphemes: 64 })),
 *   description: l.optional(l.string({ maxGraphemes: 256 })),
 *   avatar: l.optional(l.blob({ accept: ['image/*'] })),
 * }))
 *
 * // Build a record with automatic $type injection
 * const post = postSchema.build({ text: 'Hello!', createdAt: new Date().toISOString() })
 * ```
 */
export function record<
  const K extends LexiconRecordKey,
  const T extends NsidString,
  const S extends Validator<{ [k: string]: unknown }>,
>(key: K, type: AsNsid<T>, validator: S): RecordSchema<K, T, S>
export function record<
  const K extends LexiconRecordKey,
  const V extends { $type: NsidString },
>(
  key: K,
  type: AsNsid<V['$type']>,
  validator: Validator<Omit<V, '$type'>>,
): RecordSchema<K, V['$type'], Validator<Omit<V, '$type'>>>
/*@__NO_SIDE_EFFECTS__*/
export function record<
  const K extends LexiconRecordKey,
  const T extends NsidString,
  const S extends Validator<{ [k: string]: unknown }>,
>(key: K, type: T, validator: S) {
  return new RecordSchema<K, T, S>(key, type, validator)
}

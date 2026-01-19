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

export type InferRecordKey<R extends RecordSchema> =
  R extends RecordSchema<infer TKey> ? RecordKeySchemaOutput<TKey> : never

export class RecordSchema<
  const TKey extends LexiconRecordKey = any,
  const TType extends NsidString = any,
  const TShape extends Validator<{ [k: string]: unknown }> = any,
> extends Schema<
  $Typed<InferInput<TShape>, TType>,
  $Typed<InferOutput<TShape>, TType>
> {
  keySchema: RecordKeySchema<TKey>

  constructor(
    readonly key: TKey,
    readonly $type: TType,
    readonly schema: TShape,
  ) {
    super()
    this.keySchema = recordKey(key)
  }

  isTypeOf<X extends { $type?: unknown }>(
    value: X,
  ): value is X extends { $type: TType }
    ? X
    : $Typed<Exclude<X, Unknown$TypedObject>, TType> {
    return value.$type === this.$type
  }

  build(
    input: Omit<InferInput<this>, '$type'>,
  ): $Typed<InferOutput<this>, TType> {
    return this.parse($typed(input, this.$type))
  }

  $isTypeOf<X extends { $type?: unknown }>(value: X) {
    return this.isTypeOf<X>(value)
  }

  $build(input: Omit<InferInput<this>, '$type'>) {
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
 * This function offers two overloads:
 * - One that allows creating a {@link RecordSchema}, and infer the output type
 *   from the provided arguments, without requiring to specify any of the
 *   generics. This is useful when you want to define a record without
 *   explicitly defining its interface. This version does not support circular
 *   references, as TypeScript cannot infer types in such cases.
 * - One allows creating a {@link RecordSchema} with an explicitly defined
 *   interface. This will typically be used by codegen (`lex build`) to generate
 *   schemas that work even if they contain circular references.
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

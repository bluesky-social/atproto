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
import { LiteralSchema } from './literal.js'
import { StringSchema } from './string.js'

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

const keySchema = new StringSchema({ minLength: 1 })
const tidSchema = new StringSchema({ format: 'tid' })
const nsidSchema = new StringSchema({ format: 'nsid' })
const selfLiteralSchema = new LiteralSchema('self')

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
    return new LiteralSchema(value)
  }

  throw new Error(`Unsupported record key type: ${key}`)
}

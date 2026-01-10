import {
  $Typed,
  Infer,
  LexiconRecordKey,
  NsidString,
  Schema,
  TidString,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'
import { LiteralSchema } from './literal.js'
import { StringSchema } from './string.js'
import { TypedObject } from './typed-union.js'

export type InferRecordKey<R extends RecordSchema> =
  R extends RecordSchema<infer K> ? RecordKeySchemaOutput<K> : never

export type RecordSchemaOutput<
  T extends NsidString,
  S extends Validator<{ [k: string]: unknown }>,
> = $Typed<Infer<S>, T>

export class RecordSchema<
  K extends LexiconRecordKey = any,
  T extends NsidString = any,
  S extends Validator<{ [k: string]: unknown }> = any,
> extends Schema<RecordSchemaOutput<T, S>> {
  keySchema: RecordKeySchema<K>

  constructor(
    readonly key: K,
    readonly $type: T,
    readonly schema: S,
  ) {
    super()
    this.keySchema = recordKey(key)
  }

  isTypeOf<X extends { $type?: unknown }>(
    value: X,
  ): value is Exclude<X extends { $type: T } ? X : $Typed<X, T>, TypedObject> {
    return value.$type === this.$type
  }

  build<X extends Omit<Infer<S>, '$type'>>(
    input: X,
  ): $Typed<Omit<X, '$type'>, T> {
    return input.$type === this.$type
      ? (input as $Typed<X, T>)
      : { ...input, $type: this.$type }
  }

  $isTypeOf<X extends { $type?: unknown }>(value: X) {
    return this.isTypeOf<X>(value)
  }

  $build<X extends Omit<Infer<S>, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<RecordSchemaOutput<T, S>> {
    const result = ctx.validate(input, this.schema)

    if (!result.success) {
      return result
    }

    if (this.$type !== result.value.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result as ValidationResult<RecordSchemaOutput<T, S>>
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

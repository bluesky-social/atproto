import { Nsid, RecordKey, Simplify } from '../core.js'
import { ValidationResult, Validator, ValidatorContext } from '../validation.js'
import { LiteralSchema } from './literal.js'
import { StringSchema } from './string.js'

export type InferRecordKey<R extends RecordSchema> =
  R extends RecordSchema<infer K> ? RecordKeySchemaOutput<K> : never

export class RecordSchema<
  Key extends RecordKey = any,
  Output extends { $type: Nsid } = any,
> extends Validator<Output> {
  readonly lexiconType = 'record' as const

  keySchema: RecordKeySchema<Key>

  constructor(
    readonly key: Key,
    readonly $type: Output['$type'],
    readonly schema: Validator<Omit<Output, '$type'>>,
  ) {
    super()
    this.keySchema = recordKey(key)
  }

  isTypeOf<X extends { $type?: unknown }>(
    value: X,
  ): value is X extends { $type: Output['$type'] } ? X : never {
    return value.$type === this.$type
  }

  build<X extends Omit<Output, '$type'>>(
    input: X,
  ): Simplify<Omit<X, '$type'> & { $type: Output['$type'] }> {
    return { ...input, $type: this.$type }
  }

  $isTypeOf<X extends { $type?: unknown }>(value: X) {
    return this.isTypeOf<X>(value)
  }

  $build<X extends Omit<Output, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    const result = ctx.validate(input, this.schema) as ValidationResult<Output>

    if (!result.success) {
      return result
    }

    if (this.$type !== result.value.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result
  }
}

export type RecordKeySchemaOutput<Key extends RecordKey> = Key extends 'any'
  ? string
  : Key extends 'tid'
    ? string
    : Key extends 'nsid'
      ? Nsid
      : Key extends `literal:${infer L extends string}`
        ? L
        : never

export type RecordKeySchema<Key extends RecordKey> = Validator<
  RecordKeySchemaOutput<Key>
>

const keySchema = new StringSchema({ minLength: 1 })
const tidSchema = new StringSchema({ format: 'tid' })
const nsidSchema = new StringSchema({ format: 'nsid' })
const selfLiteralSchema = new LiteralSchema('self')

function recordKey<Key extends RecordKey>(key: Key): RecordKeySchema<Key> {
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

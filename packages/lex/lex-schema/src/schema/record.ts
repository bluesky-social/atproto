import {
  NsidString,
  RecordKeyDefinition,
  Simplify,
  TidString,
} from '../core.js'
import {
  Infer,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'
import { LiteralSchema } from './literal.js'
import { StringSchema } from './string.js'

export type InferRecordKey<R extends RecordSchema> =
  R extends RecordSchema<infer K, any, any, any>
    ? RecordKeySchemaOutput<K>
    : never

export class RecordSchema<
  TKeyDef extends RecordKeyDefinition = any,
  TNsid extends NsidString = any,
  TSchema extends Validator<object> = any,
  TOutput extends Infer<TSchema> & { $type: TNsid } = Infer<TSchema> & {
    $type: TNsid
  },
> extends Validator<TOutput> {
  readonly lexiconType = 'record' as const

  keySchema: RecordKeySchema<TKeyDef>

  constructor(
    readonly key: TKeyDef,
    readonly $type: TNsid,
    readonly schema: TSchema,
  ) {
    super()
    this.keySchema = recordKey(key)
  }

  isTypeOf<X extends { $type?: unknown }>(
    value: X,
  ): value is X extends { $type: TNsid } ? X : never {
    return value.$type === this.$type
  }

  build<X extends Omit<TOutput, '$type'>>(
    input: X,
  ): Simplify<Omit<X, '$type'> & { $type: TNsid }> {
    return { ...input, $type: this.$type }
  }

  $isTypeOf<X extends { $type?: unknown }>(value: X) {
    return this.isTypeOf<X>(value)
  }

  $build<X extends Omit<TOutput, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<TOutput> {
    const result = ctx.validate(input, this.schema) as ValidationResult<TOutput>

    if (!result.success) {
      return result
    }

    if (this.$type !== result.value.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result
  }
}

export type RecordKeySchemaOutput<TKeyDef extends RecordKeyDefinition> =
  TKeyDef extends 'any'
    ? string
    : TKeyDef extends 'tid'
      ? TidString
      : TKeyDef extends 'nsid'
        ? NsidString
        : TKeyDef extends `literal:${infer L extends string}`
          ? L
          : never

export type RecordKeySchema<TKeyDef extends RecordKeyDefinition> = Validator<
  RecordKeySchemaOutput<TKeyDef>
>

const keySchema = new StringSchema({ minLength: 1 })
const tidSchema = new StringSchema({ format: 'tid' })
const nsidSchema = new StringSchema({ format: 'nsid' })
const selfLiteralSchema = new LiteralSchema('self')

function recordKey<Key extends RecordKeyDefinition>(
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

import { ValidationContext, ValidationResult, Validator } from '../core.js'
import { cachedGetter } from '../lib/decorators.js'

// Basically a RecordSchema or TypedObjectSchema
export type TypedRefSchemaValidator<V extends { $type?: string } = any> =
  V extends { $type?: infer T extends string }
    ? { $type: T } & Validator<V & { $type?: T }>
    : never

export type TypedRefSchemaGetter<V extends { $type?: string } = any> =
  () => TypedRefSchemaValidator<V>

export type TypedRefSchemaOutput<V extends { $type?: string } = any> =
  V extends {
    $type?: infer T extends string
  }
    ? V & { $type: T }
    : never

export class TypedRefSchema<
  V extends { $type?: string } = any,
> extends Validator<TypedRefSchemaOutput<V>> {
  constructor(readonly getter: TypedRefSchemaGetter<V>) {
    super()
  }

  // Computed lazily to avoid resolving circular deps during init (would be undefined)
  @cachedGetter
  get schema(): TypedRefSchemaValidator<V> {
    const value = this.getter.call(null)
    if (value === undefined) throw new Error('Undefined ref')
    return value
  }

  get $type(): TypedRefSchemaOutput<V>['$type'] {
    return this.schema.$type
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<TypedRefSchemaOutput<V>> {
    const result = ctx.validate(input, this.schema)
    if (!result.success) return result

    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result as ValidationResult<TypedRefSchemaOutput<V>>
  }
}

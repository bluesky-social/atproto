import {
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

// Basically a RecordSchema or TypedObjectSchema
export type TypedRefSchemaValidator<V extends { $type?: string } = any> =
  V extends { $type?: infer T extends string }
    ? { $type: T } & Validator<V & { $type?: T }>
    : never

export type TypedRefGetter<V extends { $type?: string } = any> =
  () => TypedRefSchemaValidator<V>

export type TypedRefSchemaOutput<V extends { $type?: string } = any> =
  V extends { $type?: infer T extends string } ? V & { $type: T } : never

export class TypedRefSchema<V extends { $type?: string } = any> extends Schema<
  TypedRefSchemaOutput<V>
> {
  #getter: TypedRefGetter<V>

  constructor(getter: TypedRefGetter<V>) {
    // @NOTE In order to avoid circular dependency issues, we don't resolve
    // the schema here. Instead, we resolve it lazily when first accessed.

    super()

    this.#getter = getter
  }

  get schema(): TypedRefSchemaValidator<V> {
    const value = this.#getter.call(null)

    // Prevents a getter from depending on itself recursively, also allows GC to
    // clean up the getter function.
    this.#getter = throwAlreadyCalled

    // Cache the resolved schema on the instance
    Object.defineProperty(this, 'schema', {
      value,
      writable: false,
      enumerable: false,
      configurable: true,
    })

    return value
  }

  get $type(): TypedRefSchemaOutput<V>['$type'] {
    return this.schema.$type
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<TypedRefSchemaOutput<V>> {
    const result = ctx.validate(input, this.schema)
    if (!result.success) return result

    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result as ValidationResult<TypedRefSchemaOutput<V>>
  }
}

function throwAlreadyCalled(): never {
  throw new Error('TypedRefSchema getter called multiple times')
}

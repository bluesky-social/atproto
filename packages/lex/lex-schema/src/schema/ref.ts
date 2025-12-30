import {
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

export type RefSchemaGetter<V> = () => Validator<V>

export class RefSchema<V = any> extends Schema<V> {
  #getter: RefSchemaGetter<V>

  constructor(getter: RefSchemaGetter<V>) {
    // @NOTE In order to avoid circular dependency issues, we don't resolve
    // the schema here. Instead, we resolve it lazily when first accessed.

    super()

    this.#getter = getter
  }

  get schema(): Validator<V> {
    const value = this.#getter.call(null)

    // Prevents a getter from depending on itself recursively, also allows GC to
    // clean up the getter function.
    this.#getter = throwAlreadyCalled

    // Disable the getter and cache the resolved schema on the instance
    Object.defineProperty(this, 'schema', {
      value,
      writable: false,
      enumerable: false,
      configurable: true,
    })

    return value
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<V> {
    return ctx.validate(input, this.schema)
  }
}

function throwAlreadyCalled(): never {
  throw new Error('RefSchema getter called multiple times')
}

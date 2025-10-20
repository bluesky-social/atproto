import { ValidationContext, ValidationResult, Validator } from '../core.js'
import { cachedGetter } from '../lib/decorators.js'

export type RefSchemaGetter<V> = () => Validator<V>

export class RefSchema<V = any> extends Validator<V> {
  constructor(readonly getter: RefSchemaGetter<V>) {
    super()
  }

  // Computed lazily to avoid resolving circular deps during init (would be undefined)
  @cachedGetter
  get schema(): Validator<V> {
    return this.getter.call(null)
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<V> {
    return ctx.validate(input, this.schema)
  }
}

import { LexValidator, ValidationContext, ValidationResult } from '../core.js'
import { cachedGetter } from '../lib/decorators.js'

export type LexRefGetter<V> = () => LexValidator<V>

export class LexRef<V = any> extends LexValidator<V> {
  constructor(readonly $getter: LexRefGetter<V>) {
    super()
  }

  // Computed lazily to avoid resolving circular deps during init (would be undefined)
  @cachedGetter
  get $schema(): LexValidator<V> {
    return this.$getter.call(null)
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<V> {
    return ctx.validate(input, this.$schema)
  }
}

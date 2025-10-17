import { LexValidator, ValidationContext, ValidationResult } from '../core.js'
import { cachedGetter } from '../lib/decorators.js'

// Basically a LexRecord or LexTypedObject
export type LexTypedRefValidator<V extends { $type?: string } = any> =
  V extends { $type?: infer T extends string }
    ? { $type: T } & LexValidator<V & { $type?: T }>
    : never

export type LexTypedRefGetter<V extends { $type?: string } = any> =
  () => LexTypedRefValidator<V>

export type LexTypedRefOutput<V extends { $type?: string } = any> = V extends {
  $type?: infer T extends string
}
  ? V & { $type: T }
  : never

export class LexTypedRef<
  V extends { $type?: string } = any,
> extends LexValidator<LexTypedRefOutput<V>> {
  constructor(readonly $getter: LexTypedRefGetter<V>) {
    super()
  }

  // Computed lazily to avoid resolving circular deps during init (would be undefined)
  @cachedGetter
  get $schema(): LexTypedRefValidator<V> {
    const value = this.$getter.call(null)
    if (value === undefined) throw new Error('Undefined ref')
    return value
  }

  get $type(): LexTypedRefOutput<V>['$type'] {
    return this.$schema.$type
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<LexTypedRefOutput<V>> {
    const result = ctx.validate(input, this.$schema)
    if (!result.success) return result

    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result as ValidationResult<LexTypedRefOutput<V>>
  }
}

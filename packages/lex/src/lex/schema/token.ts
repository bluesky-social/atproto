import { LexValidator, ValidationContext, ValidationResult } from '../core.js'

export class LexToken<V extends string = any> extends LexValidator<V> {
  constructor(readonly $value: V) {
    super()
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<V> {
    if (input === this.$value) {
      return ctx.success(this.$value)
    }

    // @NOTE: allow using the token instance itself (but convert to the actual
    // token value)
    if (input instanceof LexToken && input.$value === this.$value) {
      return ctx.success(this.$value)
    }

    if (typeof input !== 'string') {
      return ctx.issueInvalidType(input, 'token')
    }

    return ctx.issueInvalidValue(input, [this.$value])
  }

  // When using the LexToken instance as data, let's serialize to the token
  // value:

  toJSON() {
    return this.$value
  }

  toString() {
    return this.$value
  }
}

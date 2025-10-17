import { LexValidator, ValidationContext, ValidationResult } from '../core.js'

export type LexBooleanOptions = {
  default?: boolean
}

export class LexBoolean extends LexValidator<boolean> {
  constructor(readonly $options: LexBooleanOptions) {
    super()
  }

  protected override $validateInContext(
    input: unknown = this.$options.default,
    ctx: ValidationContext,
  ): ValidationResult<boolean> {
    if (typeof input !== 'boolean') {
      return ctx.issueInvalidType(input, 'boolean')
    }

    return ctx.success(input as boolean)
  }
}

import {
  LexValidator,
  ValidationContext,
  ValidationResult,
  isInteger,
} from '../core.js'

export type LexIntegerOptions = {
  default?: number
  minimum?: number
  maximum?: number
}

export class LexInteger extends LexValidator<number> {
  constructor(readonly $options: LexIntegerOptions) {
    super()
  }

  protected override $validateInContext(
    input: unknown = this.$options.default,
    ctx: ValidationContext,
  ): ValidationResult<number> {
    if (!isInteger(input)) {
      return ctx.issueInvalidType(input, 'integer')
    }

    if (this.$options.minimum !== undefined && input < this.$options.minimum) {
      return ctx.issueTooSmall(input, 'integer', this.$options.minimum, input)
    }

    if (this.$options.maximum !== undefined && input > this.$options.maximum) {
      return ctx.issueTooBig(input, 'integer', this.$options.maximum, input)
    }

    return ctx.success(input)
  }
}

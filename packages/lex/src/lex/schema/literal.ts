import { LexValidator, ValidationContext, ValidationResult } from '../core.js'

export class LexLiteral<
  Output extends null | string | number | boolean = any,
> extends LexValidator<Output> {
  constructor(readonly $value: Output) {
    super()
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    if (input !== this.$value) {
      return ctx.issueInvalidValue(input, [this.$value])
    }

    return ctx.success(this.$value)
  }
}

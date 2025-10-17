import { LexValidator, ValidationContext, ValidationResult } from '../core.js'

export class LexEnum<
  Output extends null | string | number | boolean = any,
> extends LexValidator<Output> {
  constructor(readonly $values: readonly Output[]) {
    super()
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    if (!(this.$values as readonly unknown[]).includes(input)) {
      return ctx.issueInvalidValue(input, this.$values)
    }

    return ctx.success(input as Output)
  }
}

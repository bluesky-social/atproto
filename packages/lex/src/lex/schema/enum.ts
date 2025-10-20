import { ValidationContext, ValidationResult, Validator } from '../core.js'

export class EnumSchema<
  Output extends null | string | number | boolean = any,
> extends Validator<Output> {
  constructor(readonly values: readonly Output[]) {
    super()
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    if (!(this.values as readonly unknown[]).includes(input)) {
      return ctx.issueInvalidValue(input, this.values)
    }

    return ctx.success(input as Output)
  }
}

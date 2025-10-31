import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export class LiteralSchema<
  Output extends null | string | number | boolean = any,
> extends Validator<Output> {
  constructor(readonly value: Output) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    if (input !== this.value) {
      return ctx.issueInvalidValue(input, [this.value])
    }

    return ctx.success(this.value)
  }
}

import { ValidationContext, ValidationResult, Validator } from '../core.js'

export class UnknownSchema extends Validator<unknown> {
  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

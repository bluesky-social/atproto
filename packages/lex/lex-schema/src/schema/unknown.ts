import { ValidationContext, ValidationResult, Validator } from '../validation'

export class UnknownSchema extends Validator<unknown> {
  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

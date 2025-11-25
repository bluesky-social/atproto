import { ValidationResult, Validator, ValidatorContext } from '../validation'

export class UnknownSchema extends Validator<unknown> {
  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

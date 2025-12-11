import { Schema, ValidationResult, ValidatorContext } from '../validation'

export class UnknownSchema extends Schema<unknown> {
  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

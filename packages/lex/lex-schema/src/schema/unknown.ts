import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export class UnknownSchema extends Schema<unknown> {
  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

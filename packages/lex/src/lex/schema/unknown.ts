import { LexValidator, ValidationContext, ValidationResult } from '../core.js'

export class LexUnknown extends LexValidator<unknown> {
  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

import { ValidationContext, ValidationResult, Validator } from '../validation'

export class UnknownSchema extends Validator<unknown> {
  readonly lexiconType = 'unknown' as const

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<unknown> {
    return ctx.success(input)
  }
}

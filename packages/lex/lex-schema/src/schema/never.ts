import { FailureResult, ValidationContext, Validator } from '../validation.js'

export class NeverSchema extends Validator<never> {
  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): FailureResult {
    return ctx.issueInvalidType(input, 'never')
  }
}

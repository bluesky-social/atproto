import { FailureResult, ValidationContext, Validator } from '../core.js'

export class NeverSchema extends Validator<never> {
  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): FailureResult {
    return ctx.issueInvalidType(input, 'never')
  }
}

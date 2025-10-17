import { FailureResult, LexValidator, ValidationContext } from '../core.js'

export class LexNever extends LexValidator<never> {
  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): FailureResult {
    return ctx.issueInvalidType(input, 'never')
  }
}

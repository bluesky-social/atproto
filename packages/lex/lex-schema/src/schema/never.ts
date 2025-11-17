import { FailureResult, Validator, ValidatorContext } from '../validation.js'

export class NeverSchema extends Validator<never> {
  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): FailureResult {
    return ctx.issueInvalidType(input, 'never')
  }
}

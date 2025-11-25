import {
  ValidationFailure,
  Validator,
  ValidatorContext,
} from '../validation.js'

export class NeverSchema extends Validator<never> {
  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationFailure {
    return ctx.issueInvalidType(input, 'never')
  }
}

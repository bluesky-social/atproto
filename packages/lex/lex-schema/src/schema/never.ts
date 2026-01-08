import { Schema, ValidationFailure, ValidatorContext } from '../core.js'

export class NeverSchema extends Schema<never> {
  validateInContext(input: unknown, ctx: ValidatorContext): ValidationFailure {
    return ctx.issueInvalidType(input, 'never')
  }
}

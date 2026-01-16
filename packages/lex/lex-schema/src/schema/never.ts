import { Schema, ValidationContext } from '../core.js'

export class NeverSchema extends Schema<never> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.issueInvalidType(input, 'never')
  }
}

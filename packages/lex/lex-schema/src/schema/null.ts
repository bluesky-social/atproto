import { Schema, ValidationContext } from '../core.js'

export class NullSchema extends Schema<null> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input !== null) {
      return ctx.issueInvalidType(input, 'null')
    }

    return ctx.success(null)
  }
}

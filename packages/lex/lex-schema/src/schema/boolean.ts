import { Schema, ValidationContext } from '../core.js'

export class BooleanSchema extends Schema<boolean> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    if (typeof input === 'boolean') {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'boolean')
  }
}

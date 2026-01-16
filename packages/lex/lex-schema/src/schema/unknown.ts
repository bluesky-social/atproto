import { Schema, ValidationContext } from '../core.js'

export class UnknownSchema extends Schema<unknown> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.success(input)
  }
}

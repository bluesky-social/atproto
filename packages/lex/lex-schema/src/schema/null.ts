import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export class NullSchema extends Schema<null> {
  constructor() {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<null> {
    if (input !== null) {
      return ctx.issueInvalidType(input, 'null')
    }

    return ctx.success(null)
  }
}

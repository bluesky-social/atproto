import { Schema, ValidationResult, ValidatorContext } from '../validation.js'

export class NullSchema extends Schema<null> {
  readonly lexiconType = 'null' as const

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

import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export class NullSchema extends Validator<null> {
  readonly lexiconType = 'null' as const

  constructor() {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<null> {
    if (input !== null) {
      return ctx.issueInvalidType(input, 'null')
    }

    return ctx.success(null)
  }
}

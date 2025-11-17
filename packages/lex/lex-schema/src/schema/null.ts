import { ValidationResult, Validator, ValidatorContext } from '../validation.js'

export class NullSchema extends Validator<null> {
  readonly lexiconType = 'null' as const

  constructor() {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<null> {
    if (input !== null) {
      return ctx.issueInvalidType(input, 'null')
    }

    return ctx.success(null)
  }
}

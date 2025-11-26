import { ValidationResult, Validator, ValidatorContext } from '../validation.js'

export class OptionalSchema<T> extends Validator<T | undefined> {
  constructor(readonly schema: Validator<T>) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<T | undefined> {
    const result = this.schema.validateInContext(input, ctx)

    // @NOTE A default value may have been applied during validation
    if (result.success) {
      return result
    }

    if (input === undefined) {
      return ctx.success(undefined)
    }

    return result
  }
}

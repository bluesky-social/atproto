import { ValidationResult, Validator, ValidatorContext } from '../validation.js'

export class NullableSchema<T> extends Validator<T | null> {
  constructor(readonly schema: Validator<T>) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<T | null> {
    if (input === null) {
      return ctx.success(null)
    }

    return this.schema.validateInContext(input, ctx)
  }
}

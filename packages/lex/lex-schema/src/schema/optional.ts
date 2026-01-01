import {
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

export class OptionalSchema<V> extends Schema<V | undefined> {
  constructor(readonly schema: Validator<V>) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<V | undefined> {
    // @NOTE The inner schema might apply a default value so we need to run it
    // first, even if input is undefined.
    const result = ctx.validate(input, this.schema)

    if (result.success) {
      return result
    }

    if (input === undefined) {
      return ctx.success(input)
    }

    return result
  }
}

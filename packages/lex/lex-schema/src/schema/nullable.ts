import {
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

export class NullableSchema<V> extends Schema<V | null> {
  constructor(readonly schema: Validator<V>) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<V | null> {
    if (input === null) {
      return ctx.success(null)
    }

    return ctx.validate(input, this.schema)
  }
}

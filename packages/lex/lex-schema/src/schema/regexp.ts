import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export class RegexpSchema<T extends string> extends Schema<T> {
  constructor(public readonly pattern: RegExp) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<T> {
    if (typeof input !== 'string') {
      return ctx.issueInvalidType(input, 'string')
    }

    if (!this.pattern.test(input)) {
      return ctx.issueInvalidFormat(input, this.pattern.toString())
    }

    return ctx.success(input as T)
  }
}

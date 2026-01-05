import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type IntegerSchemaOptions = {
  default?: number
  minimum?: number
  maximum?: number
}

export class IntegerSchema extends Schema<number> {
  constructor(readonly options: IntegerSchemaOptions = {}) {
    super()
  }

  validateInContext(
    input: unknown = this.options?.default,
    ctx: ValidatorContext,
  ): ValidationResult<number> {
    if (!isInteger(input)) {
      return ctx.issueInvalidType(input, 'integer')
    }

    if (this.options.minimum !== undefined && input < this.options.minimum) {
      return ctx.issueTooSmall(input, 'integer', this.options.minimum, input)
    }

    if (this.options.maximum !== undefined && input > this.options.maximum) {
      return ctx.issueTooBig(input, 'integer', this.options.maximum, input)
    }

    return ctx.success(input)
  }
}

/**
 * Simple wrapper around {@link Number.isSafeInteger} that acts as a type guard.
 */
function isInteger(input: unknown): input is number {
  return Number.isSafeInteger(input)
}

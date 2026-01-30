import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type IntegerSchemaOptions = {
  minimum?: number
  maximum?: number
}

export class IntegerSchema extends Schema<number> {
  constructor(readonly options?: IntegerSchemaOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isInteger(input)) {
      return ctx.issueInvalidType(input, 'integer')
    }

    if (this.options?.minimum != null && input < this.options.minimum) {
      return ctx.issueTooSmall(input, 'integer', this.options.minimum, input)
    }

    if (this.options?.maximum != null && input > this.options.maximum) {
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

export const integer = /*#__PURE__*/ memoizedOptions(function (
  options?: IntegerSchemaOptions,
) {
  return new IntegerSchema(options)
})

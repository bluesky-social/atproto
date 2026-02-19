import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Configuration options for integer schema validation.
 *
 * @property minimum - Minimum allowed value (inclusive)
 * @property maximum - Maximum allowed value (inclusive)
 */
export type IntegerSchemaOptions = {
  minimum?: number
  maximum?: number
}

/**
 * Schema for validating integer values with optional range constraints.
 *
 * Only accepts safe integers (values that can be exactly represented in JavaScript).
 * Use {@link IntegerSchemaOptions} to constrain the allowed range.
 *
 * @example
 * ```ts
 * const schema = new IntegerSchema({ minimum: 0, maximum: 100 })
 * const result = schema.validate(42)
 * ```
 */
export class IntegerSchema extends Schema<number> {
  readonly type = 'integer' as const

  constructor(readonly options?: IntegerSchemaOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isInteger(input)) {
      return ctx.issueUnexpectedType(input, 'integer')
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

/**
 * Creates an integer schema with optional minimum and maximum constraints.
 *
 * Validates that the input is a safe integer (can be exactly represented in JavaScript)
 * and optionally falls within a specified range.
 *
 * @param options - Optional configuration for minimum and maximum values
 * @returns A new {@link IntegerSchema} instance
 *
 * @example
 * ```ts
 * // Basic integer
 * const countSchema = l.integer()
 *
 * // With minimum value
 * const positiveSchema = l.integer({ minimum: 1 })
 *
 * // With range constraints
 * const percentSchema = l.integer({ minimum: 0, maximum: 100 })
 *
 * // Age validation
 * const ageSchema = l.integer({ minimum: 0, maximum: 150 })
 * ```
 */
export const integer = /*#__PURE__*/ memoizedOptions(function (
  options?: IntegerSchemaOptions,
) {
  return new IntegerSchema(options)
})

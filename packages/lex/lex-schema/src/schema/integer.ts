import { Schema, type ValidationContext } from '../core.js'
import type { ValidationResult } from '../external.js'
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
 * Only accepts safe integers (values that can be exactly represented in JavaScript),
 * unless validating in non-strict mode, which accepts any integer.
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

  readonly options?: IntegerSchemaOptions

  constructor(options?: IntegerSchemaOptions) {
    super()
    this.options = options
  }

  validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<number> {
    if (!isInteger(input, ctx.options.strict)) {
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
 * Type guard for integer values. Strict mode only accepts safe integers. Non
 * strict mode also accepts integers beyond {@link Number.MAX_SAFE_INTEGER}: the
 * data model defines integers as 64-bit, so these are valid even though they
 * lose precision once decoded as JavaScript numbers.
 */
function isInteger(input: unknown, strict: boolean): input is number {
  return strict ? Number.isSafeInteger(input) : Number.isInteger(input)
}

/**
 * Creates an integer schema with optional minimum and maximum constraints.
 *
 * Validates that the input is a safe integer (can be exactly represented in JavaScript),
 * or any integer in non-strict mode, and optionally falls within a specified range.
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
export const integer: (options?: IntegerSchemaOptions) => IntegerSchema =
  /*#__PURE__*/ memoizedOptions((options) => new IntegerSchema(options))

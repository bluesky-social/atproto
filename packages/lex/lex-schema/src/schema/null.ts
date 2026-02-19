import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Schema for validating null values.
 *
 * Only accepts the JavaScript `null` value. Rejects `undefined` and all
 * other values.
 *
 * @example
 * ```ts
 * const schema = new NullSchema()
 * schema.validate(null)      // success
 * schema.validate(undefined) // fails
 * ```
 */
export class NullSchema extends Schema<null> {
  readonly type = 'null' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input !== null) {
      return ctx.issueUnexpectedType(input, 'null')
    }

    return ctx.success(null)
  }
}

/**
 * Creates a null schema that only accepts the null value.
 *
 * Useful for explicitly representing null in union types or optional fields.
 *
 * @returns A new {@link NullSchema} instance
 *
 * @example
 * ```ts
 * // Explicit null
 * const nullOnlySchema = l.null()
 *
 * // Nullable string (string or null)
 * const nullableStringSchema = l.union([l.string(), l.null()])
 * ```
 */
export const nullSchema = /*#__PURE__*/ memoizedOptions(function () {
  return new NullSchema()
})

export { nullSchema as null }

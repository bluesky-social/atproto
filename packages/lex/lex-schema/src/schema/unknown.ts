import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Schema that accepts any value without validation.
 *
 * Passes through any input unchanged. Use sparingly as it bypasses
 * type safety. Useful for dynamic data or when the schema is not
 * known at compile time.
 *
 * @example
 * ```ts
 * const schema = new UnknownSchema()
 * schema.validate(anything) // always succeeds
 * ```
 */
export class UnknownSchema extends Schema<unknown> {
  readonly type = 'unknown' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.success(input)
  }
}

/**
 * Creates an unknown schema that accepts any value.
 *
 * The value passes through without any validation or transformation.
 * Use this when you need to accept arbitrary data.
 *
 * @returns A new {@link UnknownSchema} instance
 *
 * @example
 * ```ts
 * // Accept any value
 * const anyDataSchema = l.unknown()
 *
 * // In an object with a dynamic field
 * const flexibleSchema = l.object({
 *   type: l.string(),
 *   data: l.unknown(),
 * })
 * ```
 */
export const unknown = /*#__PURE__*/ memoizedOptions(function () {
  return new UnknownSchema()
})

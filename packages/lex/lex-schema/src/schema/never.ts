import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Schema that always fails validation.
 *
 * Represents an impossible type - no value can satisfy this schema.
 * Useful for exhaustiveness checking or marking impossible branches.
 *
 * @example
 * ```ts
 * const schema = new NeverSchema()
 * schema.validate(anything) // always fails
 * ```
 */
export class NeverSchema extends Schema<never> {
  readonly type = 'never' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.issueUnexpectedType(input, 'never')
  }
}

/**
 * Creates a never schema that always fails validation.
 *
 * Useful for exhaustiveness checking in TypeScript or marking impossible
 * code paths.
 *
 * @returns A new {@link NeverSchema} instance
 *
 * @example
 * ```ts
 * // Exhaustiveness checking
 * type Status = 'active' | 'inactive'
 *
 * function handleStatus(status: Status) {
 *   switch (status) {
 *     case 'active': return 'Active'
 *     case 'inactive': return 'Inactive'
 *     default:
 *       // TypeScript will error if we miss a case
 *       l.never().parse(status)
 *   }
 * }
 *
 * // In impossible union branches
 * const schema = l.object({
 *   type: l.literal('fixed'),
 *   dynamic: l.never(), // This property can never exist
 * })
 * ```
 */
export const never = /*#__PURE__*/ memoizedOptions(function () {
  return new NeverSchema()
})

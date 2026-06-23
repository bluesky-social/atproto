import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Schema for validating boolean values.
 *
 * Only accepts JavaScript `true` or `false` values. Does not perform
 * any coercion from strings or numbers.
 *
 * @example
 * ```ts
 * const schema = new BooleanSchema()
 * schema.validate(true)  // success
 * schema.validate(false) // success
 * schema.validate('true') // fails - no string coercion
 * ```
 */
export class BooleanSchema extends Schema<boolean> {
  readonly type = 'boolean' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (typeof input === 'boolean') {
      return ctx.success(input)
    }

    return ctx.issueUnexpectedType(input, 'boolean')
  }
}

/**
 * Creates a boolean schema that validates true/false values.
 *
 * @returns A new {@link BooleanSchema} instance
 *
 * @example
 * ```ts
 * const enabledSchema = l.boolean()
 *
 * enabledSchema.parse(true)   // true
 * enabledSchema.parse(false)  // false
 * enabledSchema.parse('true') // throws - strings not accepted
 * ```
 */
export const boolean = /*#__PURE__*/ memoizedOptions(function () {
  return new BooleanSchema()
})

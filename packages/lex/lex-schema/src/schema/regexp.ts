import { Schema, ValidationContext } from '../core.js'

/**
 * Schema for validating strings against a regular expression pattern.
 *
 * Validates that the input is a string and matches the provided pattern.
 * The pattern is tested using RegExp.test().
 *
 * @template TValue - The string type (can be narrowed with branded types)
 *
 * @example
 * ```ts
 * const schema = new RegexpSchema(/^[a-z]+$/)
 * schema.validate('hello') // success
 * schema.validate('Hello') // fails - uppercase not allowed
 * ```
 */
export class RegexpSchema<
  TValue extends string = string,
> extends Schema<TValue> {
  readonly type = 'regexp' as const

  constructor(public readonly pattern: RegExp) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (typeof input !== 'string') {
      return ctx.issueUnexpectedType(input, 'string')
    }

    if (!this.pattern.test(input)) {
      return ctx.issueInvalidFormat(input, this.pattern.toString())
    }

    return ctx.success(input as TValue)
  }
}

/**
 * Creates a regexp schema that validates strings against a pattern.
 *
 * Useful for custom string formats not covered by the built-in format
 * validators.
 *
 * @param pattern - Regular expression pattern to match against
 * @returns A new {@link RegexpSchema} instance
 *
 * @example
 * ```ts
 * // Simple pattern
 * const slugSchema = l.regexp(/^[a-z0-9-]+$/)
 *
 * // With anchors for exact match
 * const uuidSchema = l.regexp(
 *   /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
 * )
 *
 * // Semantic versioning
 * const semverSchema = l.regexp(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/)
 *
 * // Use in object
 * const configSchema = l.object({
 *   name: l.regexp(/^[a-z][a-z0-9-]*$/), // kebab-case identifier
 *   version: semverSchema,
 * })
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function regexp<TInput extends string = string>(pattern: RegExp) {
  return new RegexpSchema<TInput>(pattern)
}

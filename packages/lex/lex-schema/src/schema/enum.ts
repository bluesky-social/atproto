import { Schema, ValidationContext } from '../core.js'

/**
 * Schema that accepts one of several specific literal values.
 *
 * Validates that the input matches one of the allowed values using strict
 * equality. Similar to TypeScript union of literals.
 *
 * @template TValue - The union of literal types
 *
 * @example
 * ```ts
 * const schema = new EnumSchema(['pending', 'active', 'completed'])
 * schema.validate('active')  // success
 * schema.validate('invalid') // fails
 * ```
 */
export class EnumSchema<
  const TValue extends null | string | number | boolean,
> extends Schema<TValue> {
  readonly type = 'enum' as const

  constructor(readonly values: readonly TValue[]) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!(this.values as readonly unknown[]).includes(input)) {
      return ctx.issueInvalidValue(input, this.values)
    }

    return ctx.success(input as TValue)
  }
}

/**
 * Creates an enum schema that accepts one of the specified values.
 *
 * Similar to TypeScript's union of string literals. Use `l.enum()` for
 * the namespace-friendly alias.
 *
 * @param value - Array of allowed values
 * @returns A new {@link EnumSchema} instance
 *
 * @example
 * ```ts
 * // String enum
 * const statusSchema = l.enum(['pending', 'active', 'completed', 'failed'])
 *
 * // Number enum
 * const prioritySchema = l.enum([1, 2, 3, 4, 5])
 *
 * // Mixed types
 * const mixedSchema = l.enum(['auto', 0, 1, true])
 *
 * // Use in objects
 * const taskSchema = l.object({
 *   title: l.string(),
 *   status: l.enum(['todo', 'in-progress', 'done']),
 * })
 *
 * // In discriminated unions
 * const resultSchema = l.discriminatedUnion('status', [
 *   l.object({ status: l.enum(['pending', 'processing']), progress: l.integer() }),
 *   l.object({ status: l.literal('completed'), result: l.unknown() }),
 * ])
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function enumSchema<const V extends null | string | number | boolean>(
  value: readonly V[],
) {
  return new EnumSchema<V>(value)
}

// @NOTE "enum" is a reserved keyword in JS/TS
export { enumSchema as enum }

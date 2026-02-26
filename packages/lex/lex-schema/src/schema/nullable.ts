import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'

/**
 * Schema wrapper that allows null values in addition to the wrapped schema.
 *
 * When the input is `null`, validation succeeds immediately. Otherwise,
 * the input is validated against the wrapped schema.
 *
 * @template TValidator - The wrapped validator type
 *
 * @example
 * ```ts
 * const schema = new NullableSchema(l.string())
 * schema.validate(null)    // success
 * schema.validate('hello') // success
 * ```
 */
export class NullableSchema<const TValidator extends Validator> extends Schema<
  InferInput<TValidator> | null,
  InferOutput<TValidator> | null
> {
  readonly type = 'nullable' as const

  constructor(readonly validator: TValidator) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input === null) {
      return ctx.success(null)
    }

    return ctx.validate(input, this.validator)
  }
}

/**
 * Creates a nullable schema that accepts null in addition to the wrapped type.
 *
 * Wraps another schema to allow null values. Different from `optional()` which
 * allows undefined.
 *
 * @param validator - The validator to make nullable
 * @returns A new {@link NullableSchema} instance
 *
 * @example
 * ```ts
 * // Nullable string
 * const nullableString = l.nullable(l.string())
 * nullableString.parse(null)    // null
 * nullableString.parse('hello') // 'hello'
 *
 * // In an object
 * const userSchema = l.object({
 *   name: l.string(),
 *   deletedAt: l.nullable(l.string({ format: 'datetime' })),
 * })
 *
 * // Combine with optional for null or undefined
 * const maybeString = l.optional(l.nullable(l.string()))
 * ```
 */
export const nullable = /*#__PURE__*/ memoizedTransformer(function <
  const TValidator extends Validator,
>(validator: TValidator) {
  return new NullableSchema<TValidator>(validator)
})

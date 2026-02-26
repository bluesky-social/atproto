import {
  InferInput,
  InferOutput,
  Schema,
  UnwrapValidator,
  ValidationContext,
  Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'
import { WithDefaultSchema } from './with-default.js'

/**
 * Schema wrapper that makes a value optional (allows undefined).
 *
 * When the input is `undefined`, validation succeeds without running the
 * inner validator. If the inner validator has a default value (via `withDefault`),
 * that default will be applied in parse mode.
 *
 * @template TValidator - The wrapped validator type
 *
 * @example
 * ```ts
 * const schema = new OptionalSchema(l.string())
 * schema.validate(undefined) // success
 * schema.validate('hello')   // success
 * ```
 */
export class OptionalSchema<TValidator extends Validator> extends Schema<
  InferInput<TValidator> | undefined,
  UnwrapValidator<TValidator> extends WithDefaultSchema<infer TValidator>
    ? InferOutput<TValidator>
    : InferOutput<TValidator> | undefined
> {
  readonly type = 'optional' as const

  constructor(readonly validator: TValidator) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // Optimization: No need to apply child schema defaults in validation mode
    if (input === undefined && ctx.options.mode === 'validate') {
      return ctx.success(input)
    }

    // @NOTE The inner schema might apply a default value so we need to run it
    // even if input is undefined.
    const result = ctx.validate(input, this.validator)

    if (result.success) {
      return result
    }

    if (input === undefined) {
      return ctx.success(input)
    }

    return result
  }
}

/**
 * Creates an optional schema that allows undefined values.
 *
 * Wraps another schema to make it optional. When used in an object schema,
 * properties with optional schemas are not required.
 *
 * @param validator - The validator to make optional
 * @returns A new {@link OptionalSchema} instance
 *
 * @example
 * ```ts
 * // Optional string
 * const optionalBio = l.optional(l.string())
 *
 * // In an object - property is not required
 * const userSchema = l.object({
 *   name: l.string(),
 *   bio: l.optional(l.string()),
 * })
 * userSchema.parse({ name: 'Alice' }) // Valid, bio is undefined
 *
 * // With default value
 * const countSchema = l.optional(l.withDefault(l.integer(), 0))
 * countSchema.parse(undefined) // Returns 0
 * ```
 */
export const optional = /*#__PURE__*/ memoizedTransformer(function <
  const TValidator extends Validator,
>(validator: TValidator) {
  return new OptionalSchema<TValidator>(validator)
})

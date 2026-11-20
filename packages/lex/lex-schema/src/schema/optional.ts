import {
  type InferInput,
  type InferOutput,
  Schema,
  type UnwrapValidator,
  ValidationContext,
  type ValidationResult,
  type Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'
import type { WithDefaultSchema } from './with-default.js'

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
  readonly validator: TValidator

  constructor(validator: TValidator) {
    super()
    this.validator = validator
  }

  validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<InferOutput<TValidator> | undefined> {
    if (input !== undefined) {
      return ctx.validate(input, this.validator)
    }

    // @NOTE In parse mode, the inner validator might replace undefined with a
    // default value, so it needs to run.
    if (ctx.options.mode === 'parse') {
      // Optimization: Most inner validators either reject undefined (building a
      // LexValidationError that is immediately discarded) or return it as-is.
      // Skipping them adds up when parsing payloads with many absent optional
      // properties.
      if (this.appliesDefault(ctx.options.strict)) {
        const result = ctx.validate(input, this.validator)
        if (result.success) return result
      }
    }

    return ctx.success(input)
  }

  #strictAppliesDefault?: boolean
  #lenientAppliesDefault?: boolean

  /**
   * Whether the inner validator replaces `undefined` with a value (eg. applies
   * a default) in "parse" mode. Validators are stateless, so this only depends
   * on the `strict` option, and is computed once per value of that option. It
   * is computed in a fresh context, so that issues already collected by the
   * context being validated can't affect it.
   */
  private appliesDefault(strict: boolean): boolean {
    const known = strict
      ? this.#strictAppliesDefault
      : this.#lenientAppliesDefault
    if (known !== undefined) return known

    const result = ValidationContext.validate(undefined, this.validator, {
      mode: 'parse',
      strict,
    })

    const appliesDefault = result.success && result.value !== undefined

    if (strict) this.#strictAppliesDefault = appliesDefault
    else this.#lenientAppliesDefault = appliesDefault

    return appliesDefault
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
export const optional: <const TValidator extends Validator>(
  validator: TValidator,
) => OptionalSchema<TValidator> = /*#__PURE__*/ memoizedTransformer(
  (validator) => new OptionalSchema(validator),
)

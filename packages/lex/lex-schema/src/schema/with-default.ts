import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

/**
 * Schema wrapper that provides a default value when the input is undefined.
 *
 * In parse mode, when the input is `undefined`, the default value is used
 * instead. In validate mode, undefined values pass through unchanged (the
 * default is not applied).
 *
 * @template TValidator - The wrapped validator type
 *
 * @example
 * ```ts
 * const schema = new WithDefaultSchema(l.integer(), 0)
 * schema.parse(undefined) // 0
 * schema.parse(42)        // 42
 * ```
 */
export class WithDefaultSchema<
  const TValidator extends Validator,
> extends Schema<InferInput<TValidator>, InferOutput<TValidator>> {
  readonly type = 'withDefault' as const

  constructor(
    readonly validator: TValidator,
    readonly defaultValue: InferInput<TValidator>,
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // When in a validation context, the output should not be altered,
    // so we don't apply the default.
    if (input === undefined && ctx.options.mode !== 'validate') {
      return ctx.validate(this.defaultValue, this.validator)
    }

    return ctx.validate(input, this.validator)
  }
}

/**
 * Creates a schema that applies a default value when the input is undefined.
 *
 * Commonly used with `optional()` to provide fallback values for missing
 * properties. The default value is validated against the schema.
 *
 * @param validator - The validator for the value
 * @param defaultValue - The default value to use when input is undefined
 * @returns A new {@link WithDefaultSchema} instance
 *
 * @example
 * ```ts
 * // Integer with default
 * const countSchema = l.withDefault(l.integer(), 0)
 * countSchema.parse(undefined) // 0
 * countSchema.parse(5)         // 5
 *
 * // Commonly combined with optional in objects
 * const settingsSchema = l.object({
 *   theme: l.optional(l.withDefault(l.string(), 'light')),
 *   pageSize: l.optional(l.withDefault(l.integer(), 25)),
 * })
 * settingsSchema.parse({}) // { theme: 'light', pageSize: 25 }
 *
 * // Boolean with default
 * const enabledSchema = l.withDefault(l.boolean(), false)
 * ```
 */
export function withDefault<const TValidator extends Validator>(
  validator: TValidator,
  defaultValue: InferInput<TValidator>,
) {
  return new WithDefaultSchema<TValidator>(validator, defaultValue)
}

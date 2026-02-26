import {
  $Typed,
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

/**
 * Interface for validators that have a $type property.
 *
 * Used by typed objects and records to identify their type in unions.
 *
 * @template TInput - The input type (with optional $type)
 * @template TOutput - The output type (with non-optional $type)
 */
export interface TypedObjectValidator<
  TInput extends { $type?: string } = { $type?: string },
  TOutput extends TInput = TInput,
> extends Validator<TInput, TOutput> {
  $type: NonNullable<TOutput['$type']>
}

/**
 * Function type that returns a typed object validator, used for lazy resolution.
 *
 * @template TValidator - The typed object validator type
 */
export type TypedRefGetter<out TValidator extends TypedObjectValidator> =
  () => TValidator

/**
 * Schema for referencing typed objects with lazy resolution.
 *
 * Used in typed unions to reference typed object schemas. Requires the
 * `$type` field to be present and match the referenced schema's type.
 * The referenced schema is resolved lazily to support circular references.
 *
 * @template TValidator - The referenced typed object validator type
 *
 * @example
 * ```ts
 * const ref = new TypedRefSchema(() => imageViewSchema)
 * // ref.$type === 'app.bsky.embed.images#view'
 * ```
 */
export class TypedRefSchema<
  const TValidator extends TypedObjectValidator = TypedObjectValidator,
> extends Schema<
  $Typed<InferInput<TValidator>>,
  $Typed<InferOutput<TValidator>>
> {
  readonly type = 'typedRef' as const

  #getter: TypedRefGetter<TValidator>

  constructor(getter: TypedRefGetter<TValidator>) {
    // @NOTE In order to avoid circular dependency issues, we don't resolve
    // the schema here. Instead, we resolve it lazily when first accessed.

    super()

    this.#getter = getter
  }

  get validator(): TValidator {
    return this.#getter.call(null)
  }

  get $type(): TValidator['$type'] {
    return this.validator.$type
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const result = ctx.validate(input, this.validator)
    if (!result.success) return result

    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result
  }
}

/**
 * Creates a reference to a typed object schema for use in typed unions.
 *
 * Unlike regular `ref()`, this requires the referenced schema to have a
 * `$type` property, and validates that the input's `$type` matches.
 *
 * @param get - Function that returns the typed object validator
 * @returns A new {@link TypedRefSchema} instance
 *
 * @example
 * ```ts
 * // Reference to image embed view
 * const imageRef = l.typedRef(() => imageViewSchema)
 *
 * // Use in a typed union
 * const embedUnion = l.typedUnion([
 *   l.typedRef(() => imageViewSchema),
 *   l.typedRef(() => videoViewSchema),
 *   l.typedRef(() => externalViewSchema),
 * ], true) // closed union
 *
 * // The $type is accessible on the ref
 * console.log(imageRef.$type) // 'app.bsky.embed.images#view'
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function typedRef<const TValidator extends TypedObjectValidator>(
  get: TypedRefGetter<TValidator>,
): TypedRefSchema<TValidator>
export function typedRef<
  TInput extends { $type?: string },
  TOutput extends TInput = TInput,
>(
  get: TypedRefGetter<TypedObjectValidator<TInput, TOutput>>,
): TypedRefSchema<TypedObjectValidator<TInput, TOutput>>
export function typedRef<const TValidator extends TypedObjectValidator>(
  get: TypedRefGetter<TValidator>,
): TypedRefSchema<TValidator> {
  return new TypedRefSchema<TValidator>(get)
}

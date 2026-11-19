import { isPlainObject } from '@atproto/lex-data'
import {
  type Definitely$Typed,
  type InferInput,
  type InferOutput,
  Schema,
  type Unknown$TypedObject,
  type ValidationContext,
  type ValidationResult,
  type Validator,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'

export interface TypedUnionValidator<
  TType extends string = string,
> extends Validator<{ $type?: TType }> {
  $type: TType
}

/**
 * Schema for Lexicon typed unions (unions discriminated by $type).
 *
 * Typed unions are collections of typed objects identified by their `$type`
 * field. Can be "open" (accept unknown types) or "closed" (only accept
 * known types).
 *
 * @template TValidators - Tuple of {@link TypedUnionValidator} instances
 * @template TClosed - Whether the union is closed (rejects unknown $types)
 *
 * @example
 * ```ts
 * const embedUnion = new TypedUnionSchema([
 *   l.typedRef(() => imageSchema),
 *   l.typedRef(() => videoSchema),
 * ], true) // closed - only accepts images and videos
 * ```
 */
export class TypedUnionSchema<
  const TValidators extends readonly TypedUnionValidator[] = [],
  const TClosed extends boolean = boolean,
> extends Schema<
  TClosed extends true
    ? Definitely$Typed<InferInput<TValidators[number]>>
    : Definitely$Typed<InferInput<TValidators[number]>> | Unknown$TypedObject,
  TClosed extends true
    ? Definitely$Typed<InferOutput<TValidators[number]>>
    : Definitely$Typed<InferOutput<TValidators[number]>> | Unknown$TypedObject
> {
  readonly type = 'typedUnion' as const

  protected readonly validators: TValidators
  public readonly closed: TClosed

  constructor(validators: TValidators, closed: TClosed) {
    // @NOTE In order to avoid circular dependency issues, we don't access the
    // refs's schema (or $type) here. Instead, we access them lazily when first
    // needed. The biggest issue with this strategy is that we can't throw
    // early if the refs contain multiple refs with the same $type.

    super()

    this.validators = validators
    this.closed = closed
  }

  get validatorsMap(): Map<unknown, TValidators[number]> {
    const map = new Map<unknown, TValidators[number]>()
    for (const ref of this.validators) map.set(ref.$type, ref)

    return lazyProperty(this, 'validatorsMap', map)
  }

  get $types(): readonly unknown[] {
    return Array.from(this.validatorsMap.keys())
  }

  validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<InferInput<TValidators[number]> | Unknown$TypedObject> {
    if (!isPlainObject(input) || !('$type' in input)) {
      return ctx.issueUnexpectedType(input, '$typed')
    }

    const { $type } = input

    const validator = this.validatorsMap.get($type)
    if (validator) {
      return ctx.validate(input, validator)
    }

    if (this.closed) {
      return ctx.issueInvalidPropertyValue(input, '$type', this.$types)
    }

    if (typeof $type !== 'string') {
      return ctx.issueInvalidPropertyType(input, '$type', 'string')
    }

    return ctx.success(input as Unknown$TypedObject)
  }
}

/**
 * Creates a typed union schema for Lexicon unions.
 *
 * Typed unions discriminate variants by their `$type` field. Can be open
 * (accepts unknown types, useful for extensibility) or closed (strict).
 *
 * @param refs - Array of typed refs for the union variants
 * @param closed - Whether to reject unknown $type values
 * @returns A new {@link TypedUnionSchema} instance
 *
 * @example
 * ```ts
 * // Closed union - only accepts known types
 * const embedSchema = l.typedUnion([
 *   l.typedRef(() => imageViewSchema),
 *   l.typedRef(() => videoViewSchema),
 *   l.typedRef(() => externalViewSchema),
 * ], true)
 *
 * // Open union - accepts unknown types for forward compatibility
 * const feedItemSchema = l.typedUnion([
 *   l.typedRef(() => postSchema),
 *   l.typedRef(() => repostSchema),
 * ], false) // unknown types pass through
 *
 * // Get all known $types
 * console.log(embedSchema.$types)
 * // ['app.bsky.embed.images#view', 'app.bsky.embed.video#view', ...]
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function typedUnion<
  const TValidators extends readonly TypedUnionValidator[],
  const TClosed extends boolean,
>(refs: TValidators, closed: TClosed): TypedUnionSchema<TValidators, TClosed> {
  return new TypedUnionSchema<TValidators, TClosed>(refs, closed)
}

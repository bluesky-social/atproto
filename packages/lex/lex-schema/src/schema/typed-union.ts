import { isPlainObject } from '@atproto/lex-data'
import {
  InferInput,
  InferOutput,
  Schema,
  Unknown$TypedObject,
  ValidationContext,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { TypedObjectSchema } from './typed-object.js'
import { TypedRefSchema } from './typed-ref.js'

/**
 * Schema for Lexicon typed unions (unions discriminated by $type).
 *
 * Typed unions are collections of typed objects identified by their `$type`
 * field. Can be "open" (accept unknown types) or "closed" (only accept
 * known types).
 *
 * @template TValidators - Tuple of {@link TypedRefSchema} or {@link TypedObjectSchema} instances
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
  const TValidators extends readonly (
    | TypedRefSchema
    | TypedObjectSchema
  )[] = [],
  const TClosed extends boolean = boolean,
> extends Schema<
  TClosed extends true
    ? InferInput<TValidators[number]>
    : InferInput<TValidators[number]> | Unknown$TypedObject,
  TClosed extends true
    ? InferOutput<TValidators[number]>
    : InferOutput<TValidators[number]> | Unknown$TypedObject
> {
  readonly type = 'typedUnion' as const

  constructor(
    protected readonly validators: TValidators,
    public readonly closed: TClosed,
  ) {
    // @NOTE In order to avoid circular dependency issues, we don't access the
    // refs's schema (or $type) here. Instead, we access them lazily when first
    // needed. The biggest issue with this strategy is that we can't throw
    // early if the refs contain multiple refs with the same $type.

    super()
  }

  get validatorsMap(): Map<unknown, TValidators[number]> {
    const map = new Map<unknown, TValidators[number]>()
    for (const ref of this.validators) map.set(ref.$type, ref)

    return lazyProperty(this, 'validatorsMap', map)
  }

  get $types() {
    return Array.from(this.validatorsMap.keys())
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
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

    return ctx.success(input)
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
  const R extends readonly TypedRefSchema[],
  const C extends boolean,
>(refs: R, closed: C) {
  return new TypedUnionSchema<R, C>(refs, closed)
}

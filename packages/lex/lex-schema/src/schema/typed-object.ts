import { isPlainObject } from '@atproto/lex-data'
import {
  $Type,
  $TypeOf,
  $Typed,
  $TypedMaybe,
  $type,
  $typed,
  InferInput,
  InferOutput,
  NsidString,
  Schema,
  Unknown$TypedObject,
  ValidationContext,
  Validator,
} from '../core.js'

export type MaybeTypedObject<
  TType extends $Type,
  TValue extends { $type?: unknown } = { $type?: unknown },
> = TValue extends { $type?: TType }
  ? TValue
  : $TypedMaybe<Exclude<TValue, Unknown$TypedObject>, TType>

/**
 * Schema for typed objects in Lexicon unions.
 *
 * Typed objects have a `$type` field that identifies which variant they are
 * in a union. The `$type` can be omitted in input (it's implicit), but if
 * present, it must match the expected value.
 *
 * @template TType - The $type string literal type
 * @template TShape - The validator type for the object's shape
 *
 * @example
 * ```ts
 * const schema = new TypedObjectSchema(
 *   'app.bsky.embed.images#view',
 *   l.object({ images: l.array(imageSchema) })
 * )
 * ```
 */
export class TypedObjectSchema<
  const TType extends $Type = $Type,
  const TShape extends Validator<{ [k: string]: unknown }> = any,
> extends Schema<
  $TypedMaybe<InferInput<TShape>, TType>,
  $TypedMaybe<InferOutput<TShape>, TType>
> {
  readonly type = 'typedObject' as const

  constructor(
    readonly $type: TType,
    readonly schema: TShape,
  ) {
    super()
  }

  isTypeOf<TValue extends Record<string, unknown>>(
    value: TValue,
  ): value is MaybeTypedObject<TType, TValue> {
    return value.$type === undefined || value.$type === this.$type
  }

  build(
    input: Omit<InferInput<this>, '$type'>,
  ): $Typed<InferOutput<this>, TType> {
    return this.parse($typed(input, this.$type)) as $Typed<
      InferOutput<this>,
      TType
    >
  }

  $isTypeOf<TValue extends Record<string, unknown>>(
    value: TValue,
  ): value is MaybeTypedObject<TType, TValue> {
    return this.isTypeOf(value)
  }

  $build(
    input: Omit<InferInput<this>, '$type'>,
  ): $Typed<InferOutput<this>, TType> {
    return this.build(input)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input)) {
      return ctx.issueUnexpectedType(input, 'object')
    }

    if (
      '$type' in input &&
      input.$type !== undefined &&
      input.$type !== this.$type
    ) {
      return ctx.issueInvalidPropertyValue(input, '$type', [this.$type])
    }

    return ctx.validate(input, this.schema)
  }
}

/**
 * Creates a typed object schema for use in Lexicon unions.
 *
 * Typed objects are identified by their `$type` field, which combines an NSID
 * and a hash (e.g., 'app.bsky.embed.images#view'). Used for union variants.
 *
 * This function offers two overloads:
 * - One that infers the type from arguments (no circular reference support)
 * - One with explicit interface for codegen with circular references
 *
 * @param nsid - The NSID part of the type (e.g., 'app.bsky.embed.images')
 * @param hash - The hash part of the type (e.g., 'view'), defaults to 'main'
 * @param validator - Schema for validating the object properties
 * @returns A new {@link TypedObjectSchema} instance
 *
 * @example
 * ```ts
 * // Image embed view
 * const imageViewSchema = l.typedObject(
 *   'app.bsky.embed.images',
 *   'view',
 *   l.object({
 *     images: l.array(l.object({
 *       thumb: l.string(),
 *       fullsize: l.string(),
 *       alt: l.string(),
 *     })),
 *   })
 * )
 *
 * // Main type (hash defaults to 'main')
 * const postViewSchema = l.typedObject(
 *   'app.bsky.feed.defs',
 *   'postView',
 *   l.object({ uri: l.string(), cid: l.string(), author: authorSchema })
 * )
 *
 * // Use $isTypeOf to narrow union types
 * if (imageViewSchema.$isTypeOf(embed)) {
 *   // embed is narrowed to image view type
 * }
 *
 * // Use $build to construct typed objects
 * const view = imageViewSchema.$build({ images: [...] })
 * // view.$type === 'app.bsky.embed.images#view'
 * ```
 */
export function typedObject<
  const N extends NsidString,
  const H extends string,
  const S extends Validator<{ [k: string]: unknown }>,
>(nsid: N, hash: H, validator: S): TypedObjectSchema<$Type<N, H>, S>
export function typedObject<V extends { $type?: $Type }>(
  nsid: V extends { $type?: infer T extends string }
    ? T extends `${infer N}#${string}`
      ? N
      : T // (T is a "main" type, so already an NSID)
    : never,
  hash: V extends { $type?: infer T extends string }
    ? T extends `${string}#${infer H}`
      ? H
      : 'main'
    : never,
  validator: Validator<Omit<V, '$type'>>,
): TypedObjectSchema<$TypeOf<V>, Validator<V>>
/*@__NO_SIDE_EFFECTS__*/
export function typedObject<
  const N extends NsidString,
  const H extends string,
  const S extends Validator<{ [k: string]: unknown }>,
>(nsid: N, hash: H, validator: S) {
  return new TypedObjectSchema<$Type<N, H>, S>($type(nsid, hash), validator)
}

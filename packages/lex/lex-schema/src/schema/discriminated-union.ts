import { isPlainObject } from '@atproto/lex-data'
import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { EnumSchema } from './enum.js'
import { LiteralSchema } from './literal.js'
import { ObjectSchema } from './object.js'

/**
 * Type representing a single variant in a discriminated union.
 *
 * Must be an ObjectSchema with the discriminator property using either
 * a LiteralSchema or EnumSchema.
 *
 * @template Discriminator - The discriminator property name
 */
export type DiscriminatedUnionVariant<Discriminator extends string = string> =
  ObjectSchema<Record<Discriminator, EnumSchema<any> | LiteralSchema<any>>>

/**
 * Type representing a non-empty tuple of discriminated union variants.
 *
 * @template TDiscriminator - The discriminator property name
 */
export type DiscriminatedUnionVariants<TDiscriminator extends string> =
  readonly [
    DiscriminatedUnionVariant<TDiscriminator>,
    ...DiscriminatedUnionVariant<TDiscriminator>[],
  ]

type DiscriminatedUnionSchemaInput<TVariants extends readonly Validator[]> =
  TVariants extends readonly [
    infer TValidator extends Validator,
    ...infer TRest extends readonly Validator[],
  ]
    ? InferInput<TValidator> | DiscriminatedUnionSchemaInput<TRest>
    : never

type DiscriminatedUnionSchemaOutput<TVariants extends readonly Validator[]> =
  TVariants extends readonly [
    infer TValidator extends Validator,
    ...infer TRest extends readonly Validator[],
  ]
    ? InferOutput<TValidator> | DiscriminatedUnionSchemaOutput<TRest>
    : never

/**
 * Schema for validating discriminated unions of objects.
 *
 * More efficient than regular union schemas when discriminating on a known
 * property. Looks up the correct variant schema directly based on the
 * discriminator value instead of trying each variant in sequence.
 *
 * @note There is no discriminated union in Lexicon schemas. This is a custom
 * extension to allow optimized validation of union of objects when using the
 * lex library programmatically (i.e. not code generated from a lexicon schema).
 *
 * @template TDiscriminator - The discriminator property name
 * @template TVariants - Tuple type of the variant schemas
 *
 * @example
 * ```ts
 * const schema = new DiscriminatedUnionSchema('type', [
 *   l.object({ type: l.literal('text'), content: l.string() }),
 *   l.object({ type: l.literal('image'), url: l.string() }),
 * ])
 * ```
 */
export class DiscriminatedUnionSchema<
  const TDiscriminator extends string,
  const TVariants extends DiscriminatedUnionVariants<TDiscriminator>,
> extends Schema<
  DiscriminatedUnionSchemaInput<TVariants>,
  DiscriminatedUnionSchemaOutput<TVariants>
> {
  readonly type = 'discriminatedUnion' as const

  readonly variantsMap: Map<unknown, DiscriminatedUnionVariant<TDiscriminator>>

  constructor(
    readonly discriminator: TDiscriminator,
    readonly variants: TVariants,
  ) {
    super()

    // Although we usually try to avoid initialization work in constructors,
    // here it is necessary to ensure that invalid discriminated throw from the
    // place of construction, rather than later during validation.
    this.variantsMap = buildVariantsMap(discriminator, variants)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input)) {
      return ctx.issueUnexpectedType(input, 'object')
    }

    const { discriminator } = this

    if (!Object.hasOwn(input, discriminator)) {
      return ctx.issueRequiredKey(input, discriminator)
    }

    const discriminatorValue = input[discriminator]

    const variant = this.variantsMap.get(discriminatorValue)
    if (variant) {
      return ctx.validate(input, variant) as ValidationResult<
        DiscriminatedUnionSchemaInput<TVariants>
      >
    }

    return ctx.issueInvalidPropertyValue(input, discriminator, [
      ...this.variantsMap.keys(),
    ])
  }
}

function buildVariantsMap<Discriminator extends string>(
  discriminator: Discriminator,
  variants: DiscriminatedUnionVariants<Discriminator>,
) {
  const variantsMap = new Map<
    unknown,
    DiscriminatedUnionVariant<Discriminator>
  >()

  for (const variant of variants) {
    const schema = variant.shape[discriminator]
    if (schema instanceof LiteralSchema) {
      if (variantsMap.has(schema.value)) {
        throw new TypeError(`Overlapping discriminator value: ${schema.value}`)
      }
      variantsMap.set(schema.value, variant)
    } else if (schema instanceof EnumSchema) {
      for (const val of schema.values) {
        if (variantsMap.has(val)) {
          throw new TypeError(`Overlapping discriminator value: ${val}`)
        }
        variantsMap.set(val, variant)
      }
    } else {
      // Only enumerable discriminator schemas are supported

      // Should never happen if types are used correctly
      throw new TypeError(
        `Discriminator schema must be a LiteralSchema or EnumSchema`,
      )
    }
  }

  return variantsMap
}

/**
 * Creates a discriminated union schema for efficient object type switching.
 *
 * Unlike regular `union()`, this schema uses a discriminator property to
 * directly look up the correct variant, providing O(1) validation instead
 * of trying each variant sequentially.
 *
 * @param discriminator - Property name to discriminate on
 * @param variants - Non-empty array of object schemas with the discriminator property
 * @returns A new {@link DiscriminatedUnionSchema} instance
 *
 * @example
 * ```ts
 * // Message types discriminated by 'kind'
 * const messageSchema = l.discriminatedUnion('kind', [
 *   l.object({ kind: l.literal('text'), text: l.string() }),
 *   l.object({ kind: l.literal('image'), url: l.string(), alt: l.optional(l.string()) }),
 *   l.object({ kind: l.literal('video'), url: l.string(), duration: l.integer() }),
 * ])
 *
 * // Using enums for multiple values mapping to same variant
 * const statusSchema = l.discriminatedUnion('status', [
 *   l.object({ status: l.enum(['pending', 'processing']), startedAt: l.string() }),
 *   l.object({ status: l.literal('completed'), completedAt: l.string() }),
 *   l.object({ status: l.literal('failed'), error: l.string() }),
 * ])
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function discriminatedUnion<
  const Discriminator extends string,
  const Options extends DiscriminatedUnionVariants<Discriminator>,
>(discriminator: Discriminator, variants: Options) {
  return new DiscriminatedUnionSchema<Discriminator, Options>(
    discriminator,
    variants,
  )
}

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

export type DiscriminatedUnionVariant<Discriminator extends string = string> =
  ObjectSchema<Record<Discriminator, EnumSchema<any> | LiteralSchema<any>>>

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
 * @note There is no discriminated union in Lexicon schemas. This is a custom
 * extension to allow optimized validation of union of objects when using the
 * lex library programmatically (i.e. not code generated from a lexicon schema).
 */
export class DiscriminatedUnionSchema<
  const TDiscriminator extends string,
  const TVariants extends DiscriminatedUnionVariants<TDiscriminator>,
> extends Schema<
  DiscriminatedUnionSchemaInput<TVariants>,
  DiscriminatedUnionSchemaOutput<TVariants>
> {
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
      return ctx.issueInvalidType(input, 'object')
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

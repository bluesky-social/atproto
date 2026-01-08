import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'
import { EnumSchema } from './enum.js'
import { LiteralSchema } from './literal.js'
import { ObjectSchema } from './object.js'

export type DiscriminatedUnionVariant<Discriminator extends string> =
  ObjectSchema<Record<Discriminator, EnumSchema | LiteralSchema>>

export type DiscriminatedUnionVariants<Discriminator extends string> =
  readonly [
    DiscriminatedUnionVariant<Discriminator>,
    ...DiscriminatedUnionVariant<Discriminator>[],
  ]

export type DiscriminatedUnionSchemaOutput<
  Variants extends readonly Validator[],
> = Variants extends readonly [
  infer V extends Validator,
  ...infer Rest extends readonly Validator[],
]
  ? Infer<V> | DiscriminatedUnionSchemaOutput<Rest>
  : never

/**
 * @note There is no discriminated union in Lexicon schemas. This is a custom
 * extension to allow optimized validation of union of objects when using the
 * lex library programmatically (i.e. not code generated from a lexicon schema).
 */
export class DiscriminatedUnionSchema<
  const Discriminator extends string = any,
  const Variants extends DiscriminatedUnionVariants<Discriminator> = any,
> extends Schema<DiscriminatedUnionSchemaOutput<Variants>> {
  readonly variantsMap: Map<unknown, DiscriminatedUnionVariant<Discriminator>>

  constructor(
    readonly discriminator: Discriminator,
    variants: Variants,
  ) {
    super()

    // Although we usually try to avoid initialization work in constructors,
    // here it is necessary to ensure that invalid discriminated throw from the
    // place of construction, rather than later during validation.
    this.variantsMap = buildVariantsMap(discriminator, variants)
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<DiscriminatedUnionSchemaOutput<Variants>> {
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
        DiscriminatedUnionSchemaOutput<Variants>
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

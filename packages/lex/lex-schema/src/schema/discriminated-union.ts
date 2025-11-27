import { isPlainObject } from '@atproto/lex-data'
import { lazyProperty } from '../util/lazy-property.js'
import {
  Infer,
  ValidationError,
  ValidationFailure,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'
import { EnumSchema } from './enum.js'
import { LiteralSchema } from './literal.js'
import { ObjectSchema } from './object.js'

export type DiscriminatedUnionSchemaVariant<Discriminator extends string> =
  ObjectSchema<Record<Discriminator, Validator>>

export type DiscriminatedUnionSchemaVariants<Discriminator extends string> =
  readonly [
    DiscriminatedUnionSchemaVariant<Discriminator>,
    ...DiscriminatedUnionSchemaVariant<Discriminator>[],
  ]

export type DiscriminatedUnionSchemaOutput<
  Variants extends readonly Validator[],
> = Variants extends readonly [infer V extends Validator]
  ? Infer<V>
  : Variants extends readonly [
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
  const Variants extends DiscriminatedUnionSchemaVariants<Discriminator> = any,
> extends Validator<DiscriminatedUnionSchemaOutput<Variants>> {
  constructor(
    readonly discriminator: Discriminator,
    readonly variants: Variants,
  ) {
    super()
  }

  /**
   * If all variants have a literal or enum for the discriminator property,
   * and there are no overlapping values, returns a map of discriminator values
   * to variants. Otherwise, returns null.
   */
  get variantsMap(): null | Map<
    unknown,
    DiscriminatedUnionSchemaVariant<Discriminator>
  > {
    const map = new Map<
      unknown,
      DiscriminatedUnionSchemaVariant<Discriminator>
    >()
    for (const variant of this.variants) {
      const schema = variant.validators[this.discriminator]
      if (schema instanceof LiteralSchema) {
        if (map.has(schema.value)) {
          return lazyProperty(this, 'variantsMap', null) // overlapping value
        }
        map.set(schema.value, variant)
      } else if (schema instanceof EnumSchema) {
        for (const val of schema.values) {
          if (map.has(val)) {
            return lazyProperty(this, 'variantsMap', null) // overlapping value
          }
          map.set(val, variant)
        }
      } else {
        return lazyProperty(this, 'variantsMap', null) // not a literal or enum
      }
    }

    return lazyProperty(this, 'variantsMap', map)
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<DiscriminatedUnionSchemaOutput<Variants>> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (!Object.hasOwn(input, this.discriminator)) {
      return ctx.issueRequiredKey(input, this.discriminator)
    }

    if (this.variantsMap) {
      // Fast path: if we have a mapping of discriminator values to variants, we
      // can directly select the correct variant to validate against. This also
      // outputs a better error (with a single failure issue) when the
      // discriminator.

      const variant = this.variantsMap.get(input[this.discriminator])
      if (!variant) {
        return ctx.issueInvalidPropertyValue(input, this.discriminator, [
          ...this.variantsMap.keys(),
        ])
      }

      return ctx.validate(input, variant) as ValidationResult<
        DiscriminatedUnionSchemaOutput<Variants>
      >
    } else {
      // Slow path: try validating against each variant and return the first
      // successful one (or aggregate all failures if none match).
      const failures: ValidationFailure[] = []

      for (const variant of this.variants) {
        const discSchema = variant.validators[this.discriminator]
        const discResult = ctx.validateChild(
          input,
          this.discriminator,
          discSchema,
        )

        if (!discResult.success) {
          failures.push(discResult)
          continue
        }

        return ctx.validate(input, variant) as ValidationResult<
          DiscriminatedUnionSchemaOutput<Variants>
        >
      }

      return {
        success: false,
        error: ValidationError.fromFailures(failures),
      }
    }
  }
}

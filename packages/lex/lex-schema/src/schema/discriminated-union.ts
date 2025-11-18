import { isPlainObject } from '@atproto/lex-data'
import { ArrayContaining } from '../core.js'
import {
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
  ObjectSchema<
    { [_ in Discriminator]: Validator },
    { required: ArrayContaining<Discriminator, string> }
  >

export type DiscriminatedUnionSchemaVariants<Discriminator extends string> =
  readonly [
    DiscriminatedUnionSchemaVariant<Discriminator>,
    ...DiscriminatedUnionSchemaVariant<Discriminator>[],
  ]

export type DiscriminatedUnionSchemaOutput<
  Options extends readonly Validator[],
> = Options extends readonly [Validator<infer V>]
  ? V
  : Options extends readonly [
        Validator<infer V>,
        ...infer Rest extends Validator[],
      ]
    ? V | DiscriminatedUnionSchemaOutput<Rest>
    : never

/**
 * @note There is no discriminated union in Lexicon schemas. This is a custom
 * extension to allow optimized validation of union of objects when using the
 * lex library programmatically (i.e. not code generated from a lexicon schema).
 */
export class DiscriminatedUnionSchema<
  const Discriminator extends string = any,
  const Options extends DiscriminatedUnionSchemaVariants<Discriminator> = any,
> extends Validator<DiscriminatedUnionSchemaOutput<Options>> {
  constructor(
    readonly discriminator: Discriminator,
    readonly variants: Options,
  ) {
    super()
  }

  /**
   * If all variants have a literal or enum for the discriminator property,
   * and there are no overlapping values, returns a map of discriminator values
   * to variants. Otherwise, returns null.
   */
  protected get variantsMap() {
    const map = new Map<
      unknown,
      DiscriminatedUnionSchemaVariant<Discriminator>
    >()
    for (const variant of this.variants) {
      const schema = variant.validators[this.discriminator]
      if (schema instanceof LiteralSchema) {
        if (map.has(schema.value)) return null // overlapping value
        map.set(schema.value, variant)
      } else if (schema instanceof EnumSchema) {
        for (const val of schema.values) {
          if (map.has(val)) return null // overlapping value
          map.set(val, variant)
        }
      } else {
        return null // not a literal or enum
      }
    }

    // Cache the map on the instance (to avoid re-computing)
    Object.defineProperty(this, 'variantsMap', {
      value: map,
      writable: false,
      enumerable: false,
      configurable: true,
    })

    return map
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<DiscriminatedUnionSchemaOutput<Options>> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (!Object.hasOwn(input, this.discriminator)) {
      return ctx.issueRequiredKey(input, this.discriminator)
    }

    // Fast path: if we have a mapping of discriminator values to variants,
    // we can directly select the correct variant to validate against. This also
    // outputs a better error (with a single failure issue) when the discriminator.
    if (this.variantsMap) {
      const variant = this.variantsMap.get(input[this.discriminator])
      if (!variant) {
        return ctx.issueInvalidPropertyValue(input, this.discriminator, [
          ...this.variantsMap.keys(),
        ])
      }

      return ctx.validate(input, variant) as ValidationResult<
        DiscriminatedUnionSchemaOutput<Options>
      >
    }

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
        DiscriminatedUnionSchemaOutput<Options>
      >
    }

    return {
      success: false,
      error: ValidationError.fromFailures(failures),
    }
  }
}

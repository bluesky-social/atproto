import {
  ArrayContaining,
  FailureResult,
  LexValidator,
  ValidationContext,
  ValidationError,
  ValidationResult,
  hasOwn,
  isObject,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'
import { LexEnum } from './enum.js'
import { LexLiteral } from './literal.js'
import { LexObject } from './object.js'

export type LexDiscriminatedUnionVariant<Discriminator extends string> =
  LexObject<
    { [_ in Discriminator]: LexValidator },
    { required: ArrayContaining<Discriminator, string> }
  >

export type LexDiscriminatedUnionVariants<Discriminator extends string> =
  readonly [
    LexDiscriminatedUnionVariant<Discriminator>,
    ...LexDiscriminatedUnionVariant<Discriminator>[],
  ]

export type LexDiscriminatedUnionOutput<
  Options extends readonly LexValidator[],
> = Options extends readonly [LexValidator<infer V>]
  ? V
  : Options extends readonly [
        LexValidator<infer V>,
        ...infer Rest extends LexValidator[],
      ]
    ? V | LexDiscriminatedUnionOutput<Rest>
    : never

/**
 * @note There is no discriminated union in Lexicon schemas. This is a custom
 * extension to allow optimized validation of union of objects when using the
 * lex library programmatically (i.e. not code generated from a lexicon schema).
 */
export class LexDiscriminatedUnion<
  const Discriminator extends string = any,
  const Options extends LexDiscriminatedUnionVariants<Discriminator> = any,
> extends LexValidator<LexDiscriminatedUnionOutput<Options>> {
  constructor(
    readonly $discriminator: Discriminator,
    readonly $variants: Options,
  ) {
    super()
  }

  /**
   * If all variants have a literal or enum for the discriminator property,
   * and there are no overlapping values, returns a map of discriminator values
   * to variants. Otherwise, returns null.
   */
  @cachedGetter
  protected get $variantsMap() {
    const map = new Map<unknown, LexDiscriminatedUnionVariant<Discriminator>>()
    for (const variant of this.$variants) {
      const schema = variant.$properties[this.$discriminator]
      if (schema instanceof LexLiteral) {
        if (map.has(schema.$value)) return null // overlapping value
        map.set(schema.$value, variant)
      } else if (schema instanceof LexEnum) {
        for (const val of schema.$values) {
          if (map.has(val)) return null // overlapping value
          map.set(val, variant)
        }
      } else {
        return null // not a literal or enum
      }
    }
    return map
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<LexDiscriminatedUnionOutput<Options>> {
    if (!isObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (!hasOwn(input, this.$discriminator)) {
      return ctx.issueRequiredKey(input, this.$discriminator)
    }

    // Fast path: if we have a mapping of discriminator values to variants,
    // we can directly select the correct variant to validate against. This also
    // outputs a better error (with a single failure issue) when the discriminator.
    if (this.$variantsMap) {
      const variant = this.$variantsMap.get(input[this.$discriminator])
      if (!variant) {
        return ctx.issueInvalidPropertyValue(input, this.$discriminator, [
          ...this.$variantsMap.keys(),
        ])
      }

      return ctx.validate(input, variant) as ValidationResult<
        LexDiscriminatedUnionOutput<Options>
      >
    }

    // Slow path: try validating against each variant and return the first
    // successful one (or aggregate all failures if none match).
    const failures: FailureResult[] = []

    for (const variant of this.$variants) {
      const discSchema = variant.$properties[this.$discriminator]
      const discResult = ctx.validateChild(
        input,
        this.$discriminator,
        discSchema,
      )

      if (!discResult.success) {
        failures.push(discResult)
        continue
      }

      return ctx.validate(input, variant) as ValidationResult<
        LexDiscriminatedUnionOutput<Options>
      >
    }

    return {
      success: false,
      error: ValidationError.fromFailures(failures),
    }
  }
}

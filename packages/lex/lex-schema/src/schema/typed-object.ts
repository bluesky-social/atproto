import { isPlainObject } from '@atproto/lex-data'
import { $Type, Simplify } from '../core.js'
import { ValidationResult, Validator, ValidatorContext } from '../validation.js'

export class TypedObjectSchema<
  Output extends { $type?: $Type } = any,
> extends Validator<Output> {
  readonly lexiconType = 'object' as const

  constructor(
    readonly $type: NonNullable<Output['$type']>,
    readonly schema: Validator<Omit<Output, '$type'>>,
  ) {
    super()
  }

  isTypeOf<X extends { $type?: unknown }>(
    value: X,
  ): value is X extends Output ? X : never {
    return value.$type === undefined || value.$type === this.$type
  }

  build<X extends Omit<Output, '$type'>>(
    input: X,
  ): Simplify<Omit<X, '$type'> & { $type: NonNullable<Output['$type']> }> {
    return { ...input, $type: this.$type }
  }

  $isTypeOf<X extends { $type?: unknown }>(value: X) {
    return this.isTypeOf<X>(value)
  }

  $build<X extends Omit<Output, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (
      '$type' in input &&
      input.$type !== undefined &&
      input.$type !== this.$type
    ) {
      return ctx.issueInvalidPropertyValue(input, '$type', [this.$type])
    }

    return ctx.validate(input, this.schema) as ValidationResult<Output>
  }
}

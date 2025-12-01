import { isPlainObject } from '@atproto/lex-data'
import { $Type, $TypeOf, Simplify } from '../core.js'
import {
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'

export class TypedObjectSchema<
  Output extends { $type?: $Type } = any,
> extends Schema<Output> {
  readonly lexiconType = 'object' as const

  constructor(
    readonly $type: $TypeOf<Output>,
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
  ): Simplify<Omit<X, '$type'> & { $type: $TypeOf<Output> }> {
    return { ...input, $type: this.$type }
  }

  $isTypeOf<X extends { $type?: unknown }>(value: X) {
    return this.isTypeOf<X>(value)
  }

  $build<X extends Omit<Output, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  validateInContext(
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

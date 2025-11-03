import { $Type, Simplify, isPlainObject } from '@atproto/lex-core'
import {
  Infer,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export class TypedObjectSchema<
  Type extends $Type = any,
  Schema extends Validator<Record<string, unknown>> = any,
  Output extends Infer<Schema> & { $type?: Type } = Infer<Schema> & {
    $type?: Type
  },
> extends Validator<Output> {
  readonly lexiconType = 'object' as const

  constructor(
    readonly $type: Type,
    readonly schema: Schema,
  ) {
    super()
  }

  typed<X extends { $type?: unknown }>(
    value: X,
  ): value is X & { $type?: Type } {
    return value.$type === undefined || value.$type === this.$type
  }

  build<X>(input: X): Simplify<Omit<X, '$type'> & { $type: Type }> {
    return { ...input, $type: this.$type }
  }

  $typed<X extends { $type?: unknown }>(value: X) {
    return this.typed<X>(value)
  }

  $build<X extends Omit<Output, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
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

    return ctx.validate(input, this.schema as Validator<Output>)
  }
}

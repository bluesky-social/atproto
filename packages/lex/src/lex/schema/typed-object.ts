import {
  Infer,
  LexValidator,
  Simplify,
  ValidationContext,
  ValidationResult,
} from '../core.js'

export class LexTypedObject<
  Type extends string = any,
  Schema extends LexValidator<object> = any,
  Output extends Infer<Schema> & { $type?: Type } = Infer<Schema> & {
    $type?: Type
  },
> extends LexValidator<Output> {
  constructor(
    readonly $type: Type,
    readonly $schema: Schema,
  ) {
    super()
  }

  $typed<X extends { $type?: unknown }>(
    value: X,
  ): value is X & { $type?: Type } {
    return value.$type === undefined || value.$type === this.$type
  }

  $build<const X extends Omit<Output, '$type'>>(
    input: X,
  ): Simplify<Omit<X, '$type'> & { $type: Type }> {
    return { ...input, $type: this.$type }
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    const result = ctx.validate(input, this.$schema)

    if (!result.success) {
      return result
    }

    if (
      '$type' in result.value &&
      result.value.$type !== undefined &&
      result.value.$type !== this.$type
    ) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result as ValidationResult<Output>
  }
}

import {
  Infer,
  LexRecordKey,
  LexValidator,
  Simplify,
  ValidationContext,
  ValidationResult,
} from '../core.js'

export class LexRecord<
  Key extends LexRecordKey = any,
  Type extends string = any,
  Schema extends LexValidator<object> = any,
  Output extends Infer<Schema> & { $type: Type } = Infer<Schema> & {
    $type: Type
  },
> extends LexValidator<Output> {
  constructor(
    readonly $key: Key,
    readonly $type: Type,
    readonly $schema: Schema,
  ) {
    super()
  }

  $typed<X extends { $type?: unknown }>(
    value: X,
  ): value is X & { $type: Type } {
    return value.$type === this.$type
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
    const result = ctx.validate(input, this.$schema) as ValidationResult<Output>

    if (!result.success) {
      return result
    }

    if (this.$type !== result.value.$type) {
      return ctx.issueInvalidPropertyValue(result.value, '$type', [this.$type])
    }

    return result
  }
}

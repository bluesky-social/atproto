import {
  FailureResult,
  Infer,
  LexValidator,
  ValidationContext,
  ValidationError,
  ValidationResult,
} from '../core.js'

export type LexUnionOptions = readonly [LexValidator, ...LexValidator[]]
export type LexUnionOutput<V extends readonly LexValidator[]> = Infer<V[number]>

export class LexUnion<
  Options extends LexUnionOptions = any,
> extends LexValidator<LexUnionOutput<Options>> {
  constructor(readonly $options: Options) {
    super()
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<LexUnionOutput<Options>> {
    const failures: FailureResult[] = []

    for (const validator of this.$options) {
      const result = ctx.validate(input, validator)
      if (result.success) {
        return result as ValidationResult<LexUnionOutput<Options>>
      } else {
        failures.push(result)
      }
    }

    return {
      success: false,
      error: ValidationError.fromFailures(failures),
    }
  }
}

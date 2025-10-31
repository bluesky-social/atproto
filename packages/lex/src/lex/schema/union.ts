import {
  FailureResult,
  Infer,
  ValidationContext,
  ValidationError,
  ValidationResult,
  Validator,
} from '../core.js'

export type UnionSchemaOptions = readonly [Validator, ...Validator[]]
export type UnionSchemaOutput<V extends readonly Validator[]> = Infer<V[number]>

export class UnionSchema<
  Options extends UnionSchemaOptions = any,
> extends Validator<UnionSchemaOutput<Options>> {
  constructor(readonly options: Options) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<UnionSchemaOutput<Options>> {
    const failures: FailureResult[] = []

    for (const validator of this.options) {
      const result = ctx.validate(input, validator)
      if (result.success) {
        return result as ValidationResult<UnionSchemaOutput<Options>>
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

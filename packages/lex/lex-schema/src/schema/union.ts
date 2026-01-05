import {
  Infer,
  Schema,
  ValidationError,
  ValidationFailure,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

export type UnionSchemaValidators = readonly [Validator, ...Validator[]]
export type UnionSchemaOutput<V extends readonly Validator[]> = Infer<V[number]>

export class UnionSchema<V extends UnionSchemaValidators = any> extends Schema<
  UnionSchemaOutput<V>
> {
  constructor(protected readonly validators: V) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<UnionSchemaOutput<V>> {
    const failures: ValidationFailure[] = []

    for (const validator of this.validators) {
      const result = ctx.validate(input, validator)
      if (result.success) {
        return result as ValidationResult<UnionSchemaOutput<V>>
      } else {
        failures.push(result)
      }
    }

    return ctx.failure(ValidationError.fromFailures(failures))
  }
}

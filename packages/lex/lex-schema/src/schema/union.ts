import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  ValidationError,
  ValidationFailure,
  Validator,
} from '../core.js'

export type UnionSchemaValidators = readonly [Validator, ...Validator[]]

export class UnionSchema<
  const TValidators extends UnionSchemaValidators = any,
> extends Schema<
  InferInput<TValidators[number]>,
  InferOutput<TValidators[number]>
> {
  constructor(protected readonly validators: TValidators) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const failures: ValidationFailure[] = []

    for (const validator of this.validators) {
      const result = ctx.validate(input, validator)
      if (result.success) return result

      failures.push(result)
    }

    return ctx.failure(ValidationError.fromFailures(failures))
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function union<const TValidators extends UnionSchemaValidators>(
  validators: TValidators,
) {
  return new UnionSchema<TValidators>(validators)
}

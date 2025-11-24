import {
  Infer,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'

export type IntersectionSchemaValidators = readonly [
  Validator,
  Validator,
  ...Validator[],
]
export type IntersectionSchemaOutput<
  V extends readonly Validator[],
  Base = unknown,
> = V extends readonly [
  infer First extends Validator,
  ...infer Rest extends Validator[],
]
  ? IntersectionSchemaOutput<Rest, Base & Infer<First>>
  : Base

export class IntersectionSchema<
  V extends IntersectionSchemaValidators = any,
> extends Validator<IntersectionSchemaOutput<V>> {
  constructor(protected readonly validators: V) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<IntersectionSchemaOutput<V>> {
    for (let i = 0; i < this.validators.length; i++) {
      const result = ctx.validate(input, this.validators[i])

      if (!result.success) {
        return result
      }

      // @NOTE because transforming the value could make it invalid for previous
      // validators, we need to ensure the input remains unchanged only gets
      // transformed by the first validator.
      if (i !== 0 && input !== result.value) {
        // The alternative would be to allow transforms on a first pass
        // (ignoring errors) and then re-validate the final value against all
        // validators (without allowing further transforms). This would be way
        // less efficient (we could make this optional).
        return ctx.issueInvalidValue(input, [result.value])
      }

      input = result.value
    }

    return ctx.success(input as IntersectionSchemaOutput<V>)
  }
}

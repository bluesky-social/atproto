import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

export class WithDefaultSchema<
  const TValidator extends Validator,
> extends Schema<InferInput<TValidator>, InferOutput<TValidator>> {
  constructor(
    readonly validator: TValidator,
    readonly defaultValue: InferInput<TValidator>,
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // When in a validation context, the output should not be altered,
    // so we don't apply the default.
    if (input === undefined && ctx.options.mode !== 'validate') {
      return ctx.validate(this.defaultValue, this.validator)
    }

    return ctx.validate(input, this.validator)
  }
}

export function withDefault<const TValidator extends Validator>(
  validator: TValidator,
  defaultValue: InferInput<TValidator>,
) {
  return new WithDefaultSchema<TValidator>(validator, defaultValue)
}

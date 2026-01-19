import {
  InferInput,
  InferOutput,
  Schema,
  UnwrapValidator,
  ValidationContext,
  Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'
import { WithDefaultSchema } from './with-default.js'

export class OptionalSchema<TValidator extends Validator> extends Schema<
  InferInput<TValidator> | undefined,
  UnwrapValidator<TValidator> extends WithDefaultSchema<infer TValidator>
    ? InferOutput<TValidator>
    : InferOutput<TValidator> | undefined
> {
  constructor(readonly validator: TValidator) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // Optimization: No need to apply child schema defaults in validation mode
    if (input === undefined && ctx.options.mode === 'validate') {
      return ctx.success(input)
    }

    // @NOTE The inner schema might apply a default value so we need to run it
    // even if input is undefined.
    const result = ctx.validate(input, this.validator)

    if (result.success) {
      return result
    }

    if (input === undefined) {
      return ctx.success(input)
    }

    return result
  }
}

export const optional = /*#__PURE__*/ memoizedTransformer(function <
  const TValidator extends Validator,
>(validator: TValidator) {
  return new OptionalSchema<TValidator>(validator)
})

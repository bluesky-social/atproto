import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'

export class NullableSchema<const TValidator extends Validator> extends Schema<
  InferInput<TValidator> | null,
  InferOutput<TValidator> | null
> {
  constructor(readonly validator: TValidator) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input === null) {
      return ctx.success(null)
    }

    return ctx.validate(input, this.validator)
  }
}

export const nullable = /*#__PURE__*/ memoizedTransformer(function <
  const TValidator extends Validator,
>(validator: TValidator) {
  return new NullableSchema<TValidator>(validator)
})

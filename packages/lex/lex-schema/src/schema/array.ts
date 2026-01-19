import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'

export type ArraySchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class ArraySchema<const TItem extends Validator> extends Schema<
  Array<InferInput<TItem>>,
  Array<InferOutput<TItem>>
> {
  constructor(
    readonly validator: TItem,
    readonly options: ArraySchemaOptions = {},
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!Array.isArray(input)) {
      return ctx.issueInvalidType(input, 'array')
    }

    const { minLength, maxLength } = this.options

    if (minLength != null && input.length < minLength) {
      return ctx.issueTooSmall(input, 'array', minLength, input.length)
    }

    if (maxLength != null && input.length > maxLength) {
      return ctx.issueTooBig(input, 'array', maxLength, input.length)
    }

    let copy: undefined | unknown[]

    for (let i = 0; i < input.length; i++) {
      const result = ctx.validateChild(input, i, this.validator)
      if (!result.success) return result

      if (result.value !== input[i]) {
        if (ctx.options.mode === 'validate') {
          // In "validate" mode, we can't modify the input, so we issue an error
          return ctx.issueInvalidPropertyValue(input, i, [result.value])
        }

        // Copy on write (but only if we did not already make a copy)
        copy ??= Array.from(input)
        copy[i] = result.value
      }
    }

    return ctx.success(copy ?? input)
  }
}

/*@__NO_SIDE_EFFECTS__*/
function arraySchema<const TValidator extends Validator>(
  items: TValidator,
  options?: ArraySchemaOptions,
): ArraySchema<TValidator>
function arraySchema<
  const TValue,
  const TValidator extends Validator<TValue> = Validator<TValue>,
>(items: TValidator, options?: ArraySchemaOptions): ArraySchema<TValidator>
function arraySchema<const TValidator extends Validator>(
  items: TValidator,
  options?: ArraySchemaOptions,
) {
  return new ArraySchema<TValidator>(items, options)
}

export const array = /*#__PURE__*/ memoizedTransformer(arraySchema)

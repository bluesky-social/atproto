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
    let array: unknown[]

    if (Array.isArray(input)) {
      array = input
    } else if (input !== undefined && ctx.options.mode === 'parse') {
      // Coerce single values into arrays in "parse" mode
      array = [input]
    } else {
      return ctx.issueInvalidType(input, 'array')
    }

    const { minLength, maxLength } = this.options

    if (minLength != null && array.length < minLength) {
      return ctx.issueTooSmall(array, 'array', minLength, array.length)
    }

    if (maxLength != null && array.length > maxLength) {
      return ctx.issueTooBig(array, 'array', maxLength, array.length)
    }

    let copy: undefined | unknown[]

    for (let i = 0; i < array.length; i++) {
      const result = ctx.validateChild(array, i, this.validator)
      if (!result.success) return result

      if (result.value !== array[i]) {
        if (ctx.options.mode === 'validate') {
          // In "validate" mode, we can't modify the input, so we issue an error
          return ctx.issueInvalidPropertyValue(array, i, [result.value])
        }

        // Copy on write (but only if we did not already make a copy)
        copy ??= Array.from(array)
        copy[i] = result.value
      }
    }

    return ctx.success(copy ?? array)
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

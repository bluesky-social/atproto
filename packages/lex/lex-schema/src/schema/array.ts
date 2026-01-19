import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

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
        // Copy on write (but only if we did not already make a copy)
        copy ??= Array.from(input)
        copy[i] = result.value
      }
    }

    return ctx.success(copy ?? input)
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function array<const TValidator extends Validator>(
  items: TValidator,
  options?: ArraySchemaOptions,
): ArraySchema<TValidator>
export function array<
  const TValue,
  const TValidator extends Validator<TValue> = Validator<TValue>,
>(items: TValidator, options?: ArraySchemaOptions): ArraySchema<TValidator>
export function array<const TValidator extends Validator>(
  items: TValidator,
  options?: ArraySchemaOptions,
) {
  return new ArraySchema<TValidator>(items, options)
}

import {
  Infer,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

export type ArraySchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class ArraySchema<const T extends Validator> extends Schema<
  Array<Infer<T>>
> {
  constructor(
    readonly itemsSchema: T,
    readonly options: ArraySchemaOptions = {},
  ) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Array<Infer<T>>> {
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

    let copy: undefined | Array<Infer<T>>

    for (let i = 0; i < input.length; i++) {
      const result = ctx.validateChild(input, i, this.itemsSchema)
      if (!result.success) return result

      if (result.value !== input[i]) {
        // Copy on write (but only if we did not already make a copy)
        copy ??= Array.from(input)
        copy[i] = result.value
      }
    }

    return ctx.success(copy ?? input) as ValidationResult<Array<Infer<T>>>
  }
}

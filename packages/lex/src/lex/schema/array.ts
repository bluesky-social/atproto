import { ValidationContext, ValidationResult, Validator } from '../core.js'

export type ArraySchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class ArraySchema<Item = any> extends Validator<Array<Item>> {
  constructor(
    readonly items: Validator<Item>,
    readonly options: ArraySchemaOptions,
  ) {
    super()
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Array<Item>> {
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

    let copy: undefined | Array<Item>

    for (let i = 0; i < input.length; i++) {
      const result = ctx.validateChild(input, i, this.items)
      if (!result.success) return result

      if (result.value !== input[i]) {
        // Copy on write (but only if we did not already make a copy)
        copy ??= Array.from(input)
        copy[i] = result.value
      }
    }

    return ctx.success(copy ?? input) as ValidationResult<Array<Item>>
  }
}

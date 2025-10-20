import {
  ValidationContext,
  ValidationResult,
  Validator,
  isArray,
  isArrayLike,
  isIterableObject,
} from '../core.js'

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
    const array = isArray(input)
      ? input
      : isArrayLike(input) || isIterableObject(input)
        ? Array.from(input) // Convert to array
        : null

    if (!array) {
      return ctx.issueInvalidType(input, 'array')
    }

    const { minLength, maxLength } = this.options

    if (minLength != null && array.length < minLength) {
      return ctx.issueTooSmall(array, 'array', minLength, array.length)
    }

    if (maxLength != null && array.length > maxLength) {
      return ctx.issueTooBig(array, 'array', maxLength, array.length)
    }

    let copy: undefined | Array<Item>

    for (let i = 0; i < array.length; i++) {
      const result = ctx.validateChild(array, i, this.items)
      if (!result.success) return result

      if (result.value !== array[i]) {
        // Copy on write (but only if we did not already make a copy)
        copy ??= (array === input ? Array.from(array) : array) as Array<Item>
        copy[i] = result.value
      }
    }

    return ctx.success(copy ?? array) as ValidationResult<Array<Item>>
  }
}

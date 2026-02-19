import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'
import { memoizedTransformer } from '../util/memoize.js'

/**
 * Configuration options for array schema validation.
 *
 * @property minLength - Minimum number of items in the array
 * @property maxLength - Maximum number of items in the array
 */
export type ArraySchemaOptions = {
  minLength?: number
  maxLength?: number
}

/**
 * Schema for validating arrays where all items match a given schema.
 *
 * Validates that the input is an array, checks length constraints, and
 * validates each item against the provided item schema.
 *
 * @template TItem - The validator type for array items
 *
 * @example
 * ```ts
 * const schema = new ArraySchema(l.string(), { maxLength: 10 })
 * const result = schema.validate(['a', 'b', 'c'])
 * ```
 */
export class ArraySchema<const TItem extends Validator> extends Schema<
  Array<InferInput<TItem>>,
  Array<InferOutput<TItem>>
> {
  readonly type = 'array' as const

  constructor(
    readonly validator: TItem,
    readonly options: ArraySchemaOptions = {},
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!Array.isArray(input)) {
      return ctx.issueUnexpectedType(input, 'array')
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

/**
 * Creates an array schema that validates each item against the provided schema.
 *
 * @param items - Schema to validate each array item against
 * @param options - Optional length constraints
 * @returns A new {@link ArraySchema} instance
 *
 * @example
 * ```ts
 * // Array of strings
 * const tagsSchema = l.array(l.string())
 *
 * // Array with length constraints
 * const limitedSchema = l.array(l.integer(), { maxLength: 100 })
 *
 * // Array of objects
 * const usersSchema = l.array(l.object({
 *   name: l.string(),
 *   age: l.integer(),
 * }))
 *
 * // Non-empty array
 * const nonEmptySchema = l.array(l.string(), { minLength: 1 })
 * ```
 */
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

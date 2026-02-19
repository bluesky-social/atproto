import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  ValidationError,
  ValidationFailure,
  Validator,
} from '../core.js'

/**
 * Type representing a non-empty tuple of validators for union schemas.
 *
 * Requires at least one validator in the tuple.
 */
export type UnionSchemaValidators = readonly [Validator, ...Validator[]]

/**
 * Schema for validating values that match one of several possible schemas.
 *
 * Tries each validator in order until one succeeds. If all validators fail,
 * returns a combined error from all attempts.
 *
 * @template TValidators - Tuple type of the validators in the union
 *
 * @example
 * ```ts
 * const schema = new UnionSchema([l.string(), l.integer()])
 * schema.validate('hello') // success
 * schema.validate(42)      // success
 * schema.validate(true)    // fails
 * ```
 */
export class UnionSchema<
  const TValidators extends UnionSchemaValidators = any,
> extends Schema<
  InferInput<TValidators[number]>,
  InferOutput<TValidators[number]>
> {
  readonly type = 'union' as const

  constructor(protected readonly validators: TValidators) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const failures: ValidationFailure[] = []

    for (const validator of this.validators) {
      const result = ctx.validate(input, validator)
      if (result.success) return result

      failures.push(result)
    }

    return ctx.failure(ValidationError.fromFailures(failures))
  }
}

/**
 * Creates a union schema that accepts values matching any of the provided schemas.
 *
 * Validators are tried in order. Use `discriminatedUnion()` for better
 * performance when discriminating on a known property.
 *
 * @param validators - Non-empty array of validators to try
 * @returns A new {@link UnionSchema} instance
 *
 * @example
 * ```ts
 * // String or number
 * const stringOrNumber = l.union([l.string(), l.integer()])
 *
 * // Nullable value
 * const nullableString = l.union([l.string(), l.null()])
 *
 * // Multiple object types
 * const mediaSchema = l.union([
 *   l.object({ type: l.literal('image'), url: l.string() }),
 *   l.object({ type: l.literal('video'), url: l.string(), duration: l.integer() }),
 * ])
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function union<const TValidators extends UnionSchemaValidators>(
  validators: TValidators,
) {
  return new UnionSchema<TValidators>(validators)
}

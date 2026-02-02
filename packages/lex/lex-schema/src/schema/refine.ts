import {
  InferInput,
  IssueCustom,
  PropertyKey,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { CustomAssertionContext } from './custom.js'

/**
 * Configuration for a refinement check that validates a condition.
 *
 * @template T - The type being validated
 * @property check - Function that returns true if the value passes the check
 * @property message - Error message when the check fails
 * @property path - Optional path to associate with the error
 */
export type RefinementCheck<T> = {
  check: (value: T, ctx: CustomAssertionContext) => boolean
  message: string
  path?: PropertyKey | readonly PropertyKey[]
}

/**
 * Configuration for a refinement assertion that narrows the type.
 *
 * @template T - The input type being validated
 * @template Out - The narrowed output type
 * @property check - Type guard function that narrows the type
 * @property message - Error message when the assertion fails
 * @property path - Optional path to associate with the error
 */
export type RefinementAssertion<T, Out extends T> = {
  check: (this: null, value: T, ctx: CustomAssertionContext) => value is Out
  message: string
  path?: PropertyKey | readonly PropertyKey[]
}

/**
 * Infers the input type from a refinement configuration.
 *
 * @template R - The refinement type
 */
export type InferRefinement<R> =
  R extends RefinementCheck<infer T>
    ? T
    : R extends RefinementAssertion<infer T, any>
      ? T
      : never

/**
 * Union type of refinement check or assertion.
 *
 * @template T - The input type being validated
 * @template Out - The output type (same as T for checks, narrowed for assertions)
 */
export type Refinement<T = any, Out extends T = T> =
  | RefinementCheck<T>
  | RefinementAssertion<T, Out>

/**
 * Creates a refined schema by adding additional validation constraints.
 *
 * Wraps an existing schema with an additional check function. The base schema
 * is validated first, then the refinement check is applied to the result.
 *
 * @param schema - The base schema to refine
 * @param refinement - The refinement check or assertion to apply
 * @returns A new schema that includes the refinement
 *
 * @example
 * ```ts
 * // Simple check refinement
 * const positiveInt = l.refine(l.integer(), {
 *   check: (value) => value > 0,
 *   message: 'Value must be positive',
 * })
 *
 * positiveInt.parse(5)  // 5
 * positiveInt.parse(-1) // throws
 *
 * // Type-narrowing assertion
 * const nonEmptyString = l.refine(l.string(), {
 *   check: (value): value is string & { length: number } => value.length > 0,
 *   message: 'String must not be empty',
 * })
 *
 * // With custom path for nested errors
 * const validDateRange = l.refine(
 *   l.object({ start: l.string(), end: l.string() }),
 *   {
 *     check: (v) => new Date(v.start) < new Date(v.end),
 *     message: 'Start date must be before end date',
 *     path: ['end'],
 *   }
 * )
 * ```
 */
export function refine<
  const TValidator extends Validator,
  TInput extends InferInput<TValidator>,
>(
  schema: TValidator,
  refinement: RefinementAssertion<InferInput<TValidator>, TInput>,
): TValidator & Validator<TInput>
export function refine<const TValidator extends Validator>(
  schema: TValidator,
  refinement: RefinementCheck<InferInput<TValidator>>,
): TValidator
export function refine<
  TRefinement extends Refinement,
  const TValidator extends Validator<InferRefinement<TRefinement>>,
>(schema: TValidator, refinement: TRefinement): TValidator
/*@__NO_SIDE_EFFECTS__*/
export function refine<const TValidator extends Validator>(
  schema: TValidator,
  refinement: Refinement<unknown>,
): TValidator {
  // This is basically the same as monkey patching the "validateInContext"
  // method to the schema, but done in a way that does not mutate the original
  // schema. This is safe to do because Validators don't update their internal
  // state over their lifetime.
  return Object.create(schema, {
    validateInContext: {
      // We do not use an arrow function to avoid creating a closure
      value: validateInContextUnbound.bind({ schema, refinement }),
      enumerable: false,
      writable: false,
      configurable: true,
    },
  })
}

/*@__NO_SIDE_EFFECTS__*/
function validateInContextUnbound<S extends Validator>(
  this: {
    schema: S
    refinement: Refinement<InferInput<S>>
  },
  input: unknown,
  ctx: ValidationContext,
): ValidationResult<InferInput<S>> {
  const result = ctx.validate(input, this.schema)
  if (!result.success) return result

  const checkResult = this.refinement.check.call(null, result.value, ctx)
  if (!checkResult) {
    const path = ctx.concatPath(this.refinement.path)
    return ctx.issue(new IssueCustom(path, input, this.refinement.message))
  }

  return result
}

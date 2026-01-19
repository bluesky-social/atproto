import {
  InferInput,
  IssueCustom,
  PropertyKey,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { CustomAssertionContext } from './custom.js'

export type RefinementCheck<T> = {
  check: (value: T, ctx: CustomAssertionContext) => boolean
  message: string
  path?: PropertyKey | readonly PropertyKey[]
}

export type RefinementAssertion<T, Out extends T> = {
  check: (this: null, value: T, ctx: CustomAssertionContext) => value is Out
  message: string
  path?: PropertyKey | readonly PropertyKey[]
}

export type InferRefinement<R> =
  R extends RefinementCheck<infer T>
    ? T
    : R extends RefinementAssertion<infer T, any>
      ? T
      : never

export type Refinement<T = any, Out extends T = T> =
  | RefinementCheck<T>
  | RefinementAssertion<T, Out>

/**
 * Create a refined schema based on an existing schema and a refinement check.
 *
 * @param schema - The base schema to refine.
 * @param refinement - The refinement check to apply.
 * @returns A new schema that includes the refinement.
 * @example
 *
 * ```ts
 * const PositiveInt = refine(l.integer(), {
 *   check: (value) => value > 0,
 *   message: 'Value must be a positive integer',
 * })
 * const result = PositiveInt.validate(-5)
 * // result.success === false
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

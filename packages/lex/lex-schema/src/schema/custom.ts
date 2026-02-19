import {
  Issue,
  IssueCustom,
  PropertyKey,
  Schema,
  ValidationContext,
} from '../core.js'

/**
 * Context object provided to custom assertion functions.
 *
 * @property path - Current validation path as an array of property keys
 * @property addIssue - Function to add additional validation issues
 */
export type CustomAssertionContext = {
  path: PropertyKey[]
  addIssue(issue: Issue): void
}

/**
 * Type guard function for custom schema validation.
 *
 * @template TValue - The type to validate/narrow to
 */
export type CustomAssertion<TValue> = (
  this: null,
  input: unknown,
  ctx: CustomAssertionContext,
) => input is TValue

/**
 * Schema with a custom validation function.
 *
 * Allows defining completely custom validation logic using a type guard
 * assertion function. The function receives the input and validation context,
 * and must return whether the input is valid.
 *
 * @template TValue - The validated output type
 *
 * @example
 * ```ts
 * const schema = new CustomSchema(
 *   (input): input is Date => input instanceof Date,
 *   'Expected a Date instance'
 * )
 * ```
 */
export class CustomSchema<out TValue = unknown> extends Schema<TValue> {
  readonly type = 'custom' as const

  constructor(
    private readonly assertion: CustomAssertion<TValue>,
    private readonly message: string,
    private readonly path?: PropertyKey | readonly PropertyKey[],
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!this.assertion.call(null, input, ctx)) {
      const path = ctx.concatPath(this.path)
      return ctx.issue(new IssueCustom(path, input, this.message))
    }
    return ctx.success(input as TValue)
  }
}

/**
 * Creates a custom schema with a user-defined validation function.
 *
 * Use this when the built-in schemas don't cover your validation needs.
 * The assertion function must be a type guard that narrows the input type.
 *
 * @param assertion - Type guard function that validates the input
 * @param message - Error message when validation fails
 * @param path - Optional path to associate with validation errors
 * @returns A new {@link CustomSchema} instance
 *
 * @example
 * ```ts
 * // Validate Date instances
 * const dateSchema = l.custom(
 *   (input): input is Date => input instanceof Date && !isNaN(input.getTime()),
 *   'Expected a valid Date'
 * )
 *
 * // Validate specific object shape
 * const pointSchema = l.custom(
 *   (input): input is { x: number; y: number } =>
 *     typeof input === 'object' &&
 *     input !== null &&
 *     typeof (input as any).x === 'number' &&
 *     typeof (input as any).y === 'number',
 *   'Expected a point with x and y coordinates'
 * )
 *
 * // With custom path
 * const validConfig = l.custom(
 *   (input): input is Config => validateConfig(input),
 *   'Invalid configuration',
 *   ['config']
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function custom<TValue>(
  assertion: CustomAssertion<TValue>,
  message: string,
  path?: PropertyKey | readonly PropertyKey[],
) {
  return new CustomSchema<TValue>(assertion, message, path)
}

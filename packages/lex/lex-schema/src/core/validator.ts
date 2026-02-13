import { PropertyKey } from './property-key.js'
import { ResultFailure, ResultSuccess, failure, success } from './result.js'
import { ValidationError } from './validation-error.js'
import {
  Issue,
  IssueInvalidFormat,
  IssueInvalidType,
  IssueInvalidValue,
  IssueRequiredKey,
  IssueTooBig,
  IssueTooSmall,
  MeasurableType,
} from './validation-issue.js'

/**
 * Represents a successful validation result.
 *
 * @typeParam Value - The type of the validated value
 */
export type ValidationSuccess<Value = unknown> = ResultSuccess<Value>

/**
 * Represents a failed validation result containing a {@link ValidationError}.
 */
export type ValidationFailure = ResultFailure<ValidationError>

/**
 * Discriminated union representing the outcome of a validation operation.
 *
 * Check the `success` property to determine if validation passed or failed:
 * - If `success` is `true`, the `value` property contains the validated data
 * - If `success` is `false`, the `reason` property contains the {@link ValidationError}
 *
 * @typeParam Value - The type of the validated value on success
 *
 * @example
 * ```typescript
 * const result: ValidationResult<string> = schema.safeParse(data)
 * if (result.success) {
 *   // result.value is string
 * } else {
 *   // result.reason is ValidationError
 * }
 * ```
 */
export type ValidationResult<Value = unknown> =
  | ValidationSuccess<Value>
  | ValidationFailure

/**
 * Extracts the input type that a validator accepts.
 *
 * Use this utility type to infer what type a schema will accept during validation.
 *
 * @typeParam V - A validator type
 *
 * @example
 * ```typescript
 * const userSchema = new ObjectSchema({ name: stringSchema, age: numberSchema })
 * type UserInput = InferInput<typeof userSchema>
 * // { name: string; age: number }
 * ```
 */
export type InferInput<V extends Validator> = V['__lex']['input']

/**
 * Extracts the output type that a validator produces after parsing.
 *
 * The output type may differ from the input type when the schema applies
 * transformations such as default values or type coercion during parsing.
 *
 * @typeParam V - A validator type
 *
 * @example
 * ```typescript
 * const schema = new StringSchema().default('hello')
 * type Input = InferInput<typeof schema>   // string | undefined
 * type Output = InferOutput<typeof schema> // string
 * ```
 */
export type InferOutput<V extends Validator> = V['__lex']['output']

/**
 * Alias for {@link InferInput} for convenient type inference.
 *
 * @typeParam V - A validator type
 */
export type { InferInput as Infer }

export interface Validator<TInput = unknown, TOutput = TInput> {
  /**
   * This property is used for type inference purposes and does not actually
   * exist at runtime.
   *
   * @internal
   * @deprecated **INTERNAL API, DO NOT USE**.
   */
  readonly ['__lex']: {
    input: TInput
    output: TOutput
  }

  /**
   * @internal **INTERNAL API**: use {@link ValidationContext.validate} instead
   *
   * This method is implemented by subclasses to perform transformation and
   * validation of the input value. Do not call this method directly; as the
   * {@link ValidationContext.options.mode} option will **not** be enforced. See
   * {@link ValidationContext.validate} for details. When delegating validation
   * from one validator sub-class implementation to another schema,
   * {@link ValidationContext.validate} must be used instead of calling
   * {@link Validator.validateInContext}. This will allow to stop the validation
   * process if the value was transformed (by the other schema) but
   * transformations are not allowed.
   *
   * By convention, the {@link ValidationResult} must return the original input
   * value if validation was successful and no transformation was applied (i.e.
   * the input already conformed to the schema). If a default value, or any
   * other transformation was applied, the returned value can be different from
   * the input.
   *
   * This convention allows the {@link Validator.check check} and
   * {@link Validator.assert assert} methods to check whether the input value
   * exactly matches the schema (without defaults or transformations), by
   * checking if the returned value is strictly equal to the input.
   *
   * @see {@link ValidationContext.validate}
   */
  validateInContext(input: unknown, ctx: ValidationContext): ValidationResult
}

/**
 * Configuration options for validation and parsing operations.
 *
 * @example
 * ```typescript
 * // Validate mode (strict, no transformations)
 * ValidationContext.validate(data, schema, { mode: 'validate' })
 *
 * // Parse mode (allows transformations like defaults)
 * ValidationContext.validate(data, schema, { mode: 'parse' })
 *
 * // With initial path for nested validation
 * ValidationContext.validate(data, schema, { path: ['user', 'profile'] })
 * ```
 */
export type ValidationOptions = {
  /**
   * The validation mode determining how transformations are handled.
   *
   * - `"validate"` (default): Strict validation where the result must be
   *   strictly equal to the input value. No transformations such as applying
   *   default values are allowed.
   * - `"parse"`: Allows the schema to transform the input value, such as
   *   applying default values or performing type coercion.
   */
  mode?: 'validate' | 'parse'

  /**
   * The initial path to the value being validated.
   *
   * This is used to provide context in validation issues when validating
   * nested structures. The path is prepended to all issue paths.
   *
   * @example
   * ```typescript
   * // Issues will be reported at paths like "user.name" instead of just "name"
   * ValidationContext.validate(data, schema, { path: ['user'] })
   * ```
   */
  path?: readonly PropertyKey[]
}

/**
 * Manages the state and context for validation operations.
 *
 * The `ValidationContext` class is responsible for:
 * - Tracking the current path in nested structures for error reporting
 * - Collecting validation issues during traversal
 * - Enforcing validation mode (validate vs parse)
 * - Providing factory methods for creating validation results
 *
 * Use the static {@link ValidationContext.validate} method as the primary entry point
 * for validation. This ensures proper mode enforcement and issue aggregation.
 *
 * @example
 * ```typescript
 * // Primary usage via static method
 * const result = ValidationContext.validate(data, schema, { mode: 'parse' })
 *
 * // Within a custom validator implementation
 * class MyValidator implements Validator {
 *   validateInContext(input: unknown, ctx: ValidationContext): ValidationResult {
 *     if (typeof input !== 'string') {
 *       return ctx.issueUnexpectedType(input, 'string')
 *     }
 *     return ctx.success(input)
 *   }
 * }
 * ```
 */
export class ValidationContext {
  /**
   * Validates input against a validator in parse mode.
   *
   * In parse mode, the schema may transform the input (e.g., apply defaults).
   *
   * @param input - The value to validate
   * @param validator - The validator to use
   * @param options - Validation options with mode set to 'parse'
   * @returns A validation result with the parsed output type
   */
  static validate<V extends Validator>(
    input: unknown,
    validator: V,
    options: ValidationOptions & {
      mode: 'parse'
    },
  ): ValidationResult<InferOutput<V>>
  /**
   * Validates input against a validator in validate mode (default).
   *
   * In validate mode, the result must be strictly equal to the input.
   * No transformations are allowed.
   *
   * @typeParam V - The validator type
   * @typeParam I - The input type
   * @param input - The value to validate
   * @param validator - The validator to use
   * @param options - Optional validation options (defaults to validate mode)
   * @returns A validation result preserving the input type intersected with the schema type
   */
  static validate<V extends Validator, I = unknown>(
    input: I,
    validator: V,
    options?: ValidationOptions & {
      mode?: 'validate'
    },
  ): ValidationResult<I & InferInput<V>>
  /**
   * Validates input against a validator with configurable options.
   *
   * @param input - The value to validate
   * @param validator - The validator to use
   * @param options - Optional validation options
   * @returns A validation result with either the input or output type
   */
  static validate<V extends Validator>(
    input: unknown,
    validator: V,
    options?: ValidationOptions,
  ): ValidationResult<InferOutput<V> | InferInput<V>>
  static validate<V extends Validator>(
    input: unknown,
    validator: V,
    options?: ValidationOptions,
  ): ValidationResult<InferOutput<V> | InferInput<V>> {
    const context = new ValidationContext({
      path: options?.path ?? [],
      mode: options?.mode ?? 'validate',
    })
    return context.validate(input, validator)
  }

  /**
   * The current path being validated, used for error reporting.
   */
  protected readonly currentPath: PropertyKey[]

  /**
   * Accumulated validation issues collected during traversal.
   */
  protected readonly issues: Issue[] = []

  /**
   * Creates a new validation context with the specified options.
   *
   * @param options - The validation options (path and mode are required)
   */
  constructor(readonly options: Required<ValidationOptions>) {
    // Create a copy because we will be mutating the array during validation.
    this.currentPath = Array.from(options.path)
  }

  /**
   * Returns a copy of the current validation path.
   *
   * The path represents the location in the data structure being validated,
   * used for constructing meaningful error messages.
   */
  get path() {
    return Array.from(this.currentPath)
  }

  /**
   * Creates a new path by appending segments to the current path.
   *
   * @param path - Optional path segment(s) to append
   * @returns A new path array with the segment(s) appended
   */
  concatPath(path?: PropertyKey | readonly PropertyKey[]) {
    if (path == null) return this.path
    return this.currentPath.concat(path)
  }

  /**
   * Validates input against a validator within this context.
   *
   * This is the primary entry point for validation within a context. Always use
   * this method instead of calling {@link Validator.validateInContext} directly,
   * as this method enforces validation mode rules and handles transformation detection.
   *
   * @typeParam V - The validator type
   * @param input - The value to validate
   * @param validator - The validator to use
   * @returns A validation result with the validated value or error
   */
  validate<V extends Validator>(
    input: unknown,
    validator: V,
  ): ValidationResult<InferInput<V>> {
    // This is the only place where validateInContext should be called.
    const result = validator.validateInContext(input, this)

    if (result.success) {
      if (this.issues.length > 0) {
        // Validator returned a success but issues were added via the context.
        // This means the overall validation failed.
        return failure(new ValidationError(Array.from(this.issues)))
      }

      if (this.options.mode !== 'parse' && !Object.is(result.value, input)) {
        // If the value changed, it means that a default (or some other
        // transformation) was applied, meaning that the original value did
        // *not* match the (output) schema. When not in "parse" mode, we
        // consider this a failure.

        // This check is the reason why Validator.validateInContext should not
        // be used directly, and ValidatorContext.validate should be used
        // instead, even when delegating validation from one validator to
        // another.

        // This if block comes before the next one because 'this.issues' will
        // end-up being appended to the returned ValidationError (see the
        // "failure" method below), resulting in a more complete error report.
        return this.issueInvalidValue(input, [result.value])
      }
    }

    return result as ValidationResult<InferInput<V>>
  }

  /**
   * Validates a child property of an object within this context.
   *
   * This method automatically manages the path stack, pushing the property key
   * before validation and popping it afterward. Use this for validating object
   * properties to ensure proper path tracking in error messages.
   *
   * @typeParam I - The input object type
   * @typeParam K - The property key type
   * @typeParam V - The validator type
   * @param input - The parent object containing the property
   * @param key - The property key to validate
   * @param validator - The validator to use for the property value
   * @returns A validation result for the property value
   *
   * @example
   * ```typescript
   * // In a custom object validator
   * const result = ctx.validateChild(input, 'name', stringSchema)
   * // If validation fails, error path will include 'name'
   * ```
   */
  validateChild<
    I extends object,
    K extends PropertyKey & keyof I,
    V extends Validator,
  >(input: I, key: K, validator: V): ValidationResult<InferInput<V>> {
    // @NOTE we could add support for recursive schemas by keeping track of
    // "parent" objects in the context and checking for circular references
    // here. This would allow us to validate recursive structures without
    // hitting maximum call stack errors, and would also allow us to provide
    // better error messages for circular reference issues. However, this is not
    // a priority at the moment as recursive structures are not supported in
    // the context of AT Protocol lexicons, and we can always add this in the
    // future if needed.

    // Instead of creating a new context, we just push/pop the path segment.
    this.currentPath.push(key)
    try {
      return this.validate(input[key], validator)
    } finally {
      this.currentPath.length--
    }
  }

  /**
   * Adds a validation issue to the context without immediately failing.
   *
   * Use this method to collect multiple issues during validation before
   * determining the final result. Issues added this way will be included
   * in the final error if validation fails.
   *
   * @param issue - The validation issue to add
   */
  addIssue(issue: Issue): void {
    this.issues.push(issue)
  }

  /**
   * Creates a successful validation result with the given value.
   *
   * @typeParam V - The value type
   * @param value - The validated value
   * @returns A successful validation result
   */
  success<V>(value: V): ValidationResult<V> {
    return success(value)
  }

  /**
   * Creates a failed validation result with the given error.
   *
   * @param reason - The validation error
   * @returns A failed validation result
   */
  failure(reason: ValidationError): ValidationFailure {
    return failure(reason)
  }

  /**
   * Creates a failed validation result from a single issue.
   *
   * Any previously accumulated issues in the context are included in the error.
   *
   * @param issue - The validation issue that caused the failure
   * @returns A failed validation result
   */
  issue(issue: Issue) {
    return this.failure(new ValidationError([...this.issues, issue]))
  }

  /**
   * Creates a failure for an invalid value that doesn't match expected values.
   *
   * @param input - The actual value that was received
   * @param values - The expected valid values
   * @returns A failed validation result with an invalid value issue
   */
  issueInvalidValue(input: unknown, values: readonly unknown[]) {
    return this.issue(new IssueInvalidValue(this.path, input, values))
  }

  /**
   * Creates a failure for an invalid type.
   *
   * @param input - The actual value that was received
   * @param expected - An array of expected type names
   * @returns A failed validation result with an invalid type issue
   */
  issueInvalidType(input: unknown, expected: readonly string[]) {
    return this.issue(new IssueInvalidType(this.path, input, expected))
  }

  /**
   * Creates a failure for an invalid type.
   *
   * @param input - The actual value that was received
   * @param expected - The expected type name
   * @returns A failed validation result with an invalid type issue
   */
  issueUnexpectedType(input: unknown, expected: string) {
    return this.issueInvalidType(input, [expected])
  }

  /**
   * Creates a failure for a missing required key in an object.
   *
   * @param input - The object missing the required key
   * @param key - The name of the required key
   * @returns A failed validation result with a required key issue
   */
  issueRequiredKey(input: object, key: PropertyKey) {
    return this.issue(new IssueRequiredKey(this.path, input, key))
  }

  /**
   * Creates a failure for an invalid string format.
   *
   * @param input - The actual value that was received
   * @param format - The expected format name (e.g., 'did', 'handle', 'uri')
   * @param msg - Optional additional message describing the format error
   * @returns A failed validation result with an invalid format issue
   */
  issueInvalidFormat(input: unknown, format: string, msg?: string) {
    return this.issue(new IssueInvalidFormat(this.path, input, format, msg))
  }

  /**
   * Creates a failure for a value that exceeds a maximum constraint.
   *
   * @param input - The actual value that was received
   * @param type - The type of measurement (e.g., 'string', 'array', 'bytes')
   * @param max - The maximum allowed value
   * @param actual - The actual measured value
   * @returns A failed validation result with a too big issue
   */
  issueTooBig(
    input: unknown,
    type: MeasurableType,
    max: number,
    actual: number,
  ) {
    return this.issue(new IssueTooBig(this.path, input, max, type, actual))
  }

  /**
   * Creates a failure for a value that is below a minimum constraint.
   *
   * @param input - The actual value that was received
   * @param type - The type of measurement (e.g., 'string', 'array', 'bytes')
   * @param min - The minimum required value
   * @param actual - The actual measured value
   * @returns A failed validation result with a too small issue
   */
  issueTooSmall(
    input: unknown,
    type: MeasurableType,
    min: number,
    actual: number,
  ) {
    return this.issue(new IssueTooSmall(this.path, input, min, type, actual))
  }

  /**
   * Creates a failure for an invalid property value within an object.
   *
   * This is a convenience method that automatically extracts the property value
   * and constructs the appropriate path.
   *
   * @typeParam I - The input object type
   * @param input - The object containing the invalid property
   * @param property - The property key with the invalid value
   * @param values - The expected valid values
   * @returns A failed validation result with an invalid value issue at the property path
   */
  issueInvalidPropertyValue<I>(
    input: I,
    property: keyof I & PropertyKey,
    values: readonly unknown[],
  ) {
    const value = input[property]
    const path = this.concatPath(property)
    return this.issue(new IssueInvalidValue(path, value, values))
  }

  /**
   * Creates a failure for an invalid property type within an object.
   *
   * This is a convenience method that automatically extracts the property value
   * and constructs the appropriate path.
   *
   * @typeParam I - The input object type
   * @param input - The object containing the invalid property
   * @param property - The property key with the invalid type
   * @param expected - The expected type name
   * @returns A failed validation result with an invalid type issue at the property path
   */
  issueInvalidPropertyType<I>(
    input: I,
    property: keyof I & PropertyKey,
    expected: string,
  ) {
    const value = input[property]
    const path = this.concatPath(property)
    return this.issue(new IssueInvalidType(path, value, [expected]))
  }
}

/**
 * Recursively unwraps a wrapped validator to its innermost validator type.
 *
 * Some validators wrap other validators (e.g., optional, nullable). This type
 * utility recursively unwraps such wrappers to reveal the core validator.
 *
 * @typeParam T - A validator type, possibly wrapped
 *
 * @example
 * ```typescript
 * type Inner = UnwrapValidator<OptionalValidator<NullableValidator<StringSchema>>>
 * // Result: StringSchema
 * ```
 */
export type UnwrapValidator<T extends Validator> = T extends {
  unwrap(): infer U extends Validator
}
  ? UnwrapValidator<U>
  : T

/**
 * Interface for validators that wrap another validator.
 *
 * Implement this interface when creating validators that wrap or modify
 * the behavior of another validator (e.g., optional, nullable, transform).
 *
 * @typeParam Validator - The type of the wrapped validator
 *
 * @example
 * ```typescript
 * class OptionalSchema<V extends Validator> implements WrappedValidator<V> {
 *   constructor(private inner: V) {}
 *
 *   unwrap(): V {
 *     return this.inner
 *   }
 * }
 * ```
 */
export interface WrappedValidator<out Validator> {
  /**
   * Returns the inner wrapped validator.
   *
   * @returns The wrapped validator
   */
  unwrap(): Validator
}

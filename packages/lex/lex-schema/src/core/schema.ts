import {
  InferInput,
  InferOutput,
  ValidationContext,
  ValidationOptions,
  ValidationResult,
  Validator,
} from './validator.js'

/**
 * Options for parsing operations.
 * Excludes the `mode` option as it is implicitly set to `"parse"`.
 */
export type ParseOptions = Omit<ValidationOptions, 'mode'>

/**
 * Options for validation operations.
 * Excludes the `mode` option as it is implicitly set to `"validate"`.
 */
export type ValidateOptions = Omit<ValidationOptions, 'mode'>

/**
 * Internal type structure for schema type inference.
 *
 * This interface defines the phantom types used for compile-time type inference
 * without affecting runtime behavior. The `input` and `output` properties
 * represent the expected input type during validation and the resulting output
 * type after parsing, respectively.
 *
 * @typeParam TInput - The type accepted as input during validation
 * @typeParam TOutput - The type returned after parsing (may differ from input due to coercion)
 */
export interface SchemaInternals<out TInput = unknown, out TOutput = TInput> {
  input: TInput
  output: TOutput
}

/**
 * Abstract base class for all schema validators in the lexicon system.
 *
 * This class provides the standard validation interface that all schema types
 * implement. It offers multiple methods for validating and parsing data:
 *
 * - **Assertion methods**: `assert()`, `check()` - throw on invalid input
 * - **Type guard methods**: `matches()`, `ifMatches()` - return boolean or optional value
 * - **Parse methods**: `parse()`, `safeParse()` - allow value transformation/coercion
 * - **Validate methods**: `validate()`, `safeValidate()` - strict validation without coercion
 *
 * All methods are also available with a `$` prefix (e.g., `$parse()`, `$validate()`)
 * for consistent access in generated lexicon namespaces.
 *
 * @typeParam TInput - The type accepted as valid input during validation
 * @typeParam TOutput - The type returned after parsing (may include transformations)
 * @typeParam TInternals - Internal type structure for type inference
 *
 * @example
 * ```typescript
 * class MySchema extends Schema<string> {
 *   validateInContext(input: unknown, ctx: ValidationContext): ValidationResult {
 *     if (typeof input !== 'string') {
 *       return ctx.issueUnexpectedType(input, 'string')
 *     }
 *     return ctx.success(input)
 *   }
 * }
 *
 * const schema = new MySchema()
 * schema.assert('hello')     // OK
 * schema.assert(123)         // Throws ValidationError
 * schema.matches('hello')    // true
 * schema.matches(123)        // false
 * ```
 */
export abstract class Schema<
  out TInput = unknown,
  out TOutput = TInput,
  out TInternals extends SchemaInternals<TInput, TOutput> = SchemaInternals<
    TInput,
    TOutput
  >,
> implements Validator<TInternals['input'], TInternals['output']>
{
  /**
   * Internal phantom property for type inference.
   * This property does not exist at runtime.
   *
   * @internal
   */
  declare readonly ['__lex']: TInternals

  // Needed to discriminate multiple schema types when used in unions. Without
  // this, Typescript could allow an EnumSchema<"foo" | "bar"> to be used where
  // a StringSchema is expected, since they would both be structurally
  // compatible.
  abstract readonly type: string

  /**
   * Performs validation of the input value within a validation context.
   *
   * This method must be implemented by subclasses to define the actual
   * validation logic. It should not be called directly; use
   * {@link ValidationContext.validate} instead to ensure proper mode enforcement.
   *
   * @param input - The value to validate
   * @param ctx - The validation context providing path tracking and issue reporting
   * @returns A validation result indicating success with the validated value or failure with issues
   *
   * @internal
   */
  abstract validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult

  /**
   * @note use {@link check}() instead of {@link assert}() if you encounter a
   * `ts(2775)` error and you are not able to fully type the validator. This
   * will typically arise in generic contexts, where the narrowed type is not
   * needed.
   */
  assert(input: unknown): asserts input is InferInput<this> {
    const result = ValidationContext.validate(input, this)
    if (!result.success) throw result.reason
  }

  /**
   * Alias for {@link assert}(). Most useful in generic contexts where the
   * validator is not exactly typed, allowing to avoid "_Assertions require
   * every name in the call target to be declared with an explicit type
   * annotation. ts(2775)_" errors.
   */
  check(input: unknown): void {
    this.assert(input)
  }

  /**
   * Casts the input (by validating it) to the output type if it matches the
   * schema, otherwise throws. This is the same as calling {@link parse}() with
   * `mode: "validate"`.
   */
  cast<I>(input: I): I & InferInput<this> {
    const result = ValidationContext.validate(input, this)
    if (result.success) return result.value
    throw result.reason
  }

  /**
   * Type guard that checks if the input matches this schema.
   *
   * @param input - The value to check
   * @returns `true` if the input is valid according to this schema
   *
   * @example
   * ```typescript
   * if (schema.matches(data)) {
   *   // data is narrowed to the schema's input type
   *   console.log(data)
   * }
   * ```
   */
  matches<I>(input: I): input is I & InferInput<this> {
    const result = ValidationContext.validate(input, this)
    return result.success
  }

  /**
   * Returns the input if it matches this schema, otherwise returns `undefined`.
   *
   * This is useful for optional filtering operations where you want to
   * conditionally extract values that match a schema.
   *
   * @param input - The value to check
   * @returns The input value with narrowed type if valid, otherwise `undefined`
   *
   * @example
   * ```typescript
   * const validData = schema.ifMatches(data)
   * if (validData !== undefined) {
   *   // validData is the schema's input type
   *   console.log(validData)
   * }
   * ```
   */
  ifMatches<I>(input: I): (I & InferInput<this>) | undefined {
    return this.matches(input) ? input : undefined
  }

  /**
   * Parses the input, allowing value transformations and coercion.
   *
   * Unlike {@link validate}, this method allows the schema to transform
   * the input value (e.g., applying default values, type coercion).
   * Throws a {@link ValidationError} if the input is invalid.
   *
   * @param input - The value to parse
   * @param options - Optional parsing configuration
   * @returns The parsed and potentially transformed value
   * @throws {ValidationError} If the input fails validation
   *
   * @example
   * ```typescript
   * const result = schema.parse(rawData)
   * // result has defaults applied and is fully typed
   * ```
   */
  parse(input: unknown, options?: ParseOptions): InferOutput<this> {
    const result = this.safeParse(input, options)
    if (result.success) return result.value
    throw result.reason
  }

  /**
   * Safely parses the input without throwing, returning a result object.
   *
   * This method allows value transformations like {@link parse}, but
   * returns a discriminated union result instead of throwing on error.
   *
   * @param input - The value to parse
   * @param options - Optional parsing configuration
   * @returns A {@link ValidationResult} with either the parsed value or validation errors
   *
   * @example
   * ```typescript
   * const result = schema.safeParse(data)
   * if (result.success) {
   *   console.log(result.value)
   * } else {
   *   console.error(result.reason.issues)
   * }
   * ```
   */
  safeParse(
    input: unknown,
    options?: ParseOptions,
  ): ValidationResult<InferOutput<this>> {
    return ValidationContext.validate(input, this, {
      ...options,
      mode: 'parse',
    })
  }

  /**
   * Validates the input strictly without allowing transformations.
   *
   * Unlike {@link parse}, this method requires the input to exactly match
   * the schema without any transformations (no defaults applied, no coercion).
   * Throws a {@link ValidationError} if the input is invalid or would require transformation.
   *
   * @typeParam I - The input type (preserved in the return type)
   * @param input - The value to validate
   * @param options - Optional validation configuration
   * @returns The validated input with narrowed type
   * @throws {ValidationError} If the input fails validation or requires transformation
   *
   * @example
   * ```typescript
   * const validated = schema.validate(data)
   * // validated is typed as the intersection of input type and schema type
   * ```
   */
  validate<I>(input: I, options?: ValidateOptions): I & InferInput<this> {
    const result = this.safeValidate(input, options)
    if (result.success) return result.value
    throw result.reason
  }

  /**
   * Safely validates the input without throwing, returning a result object.
   *
   * This method performs strict validation like {@link validate}, but
   * returns a discriminated union result instead of throwing on error.
   *
   * @typeParam I - The input type (preserved in the result value type)
   * @param input - The value to validate
   * @param options - Optional validation configuration
   * @returns A {@link ValidationResult} with either the validated value or validation errors
   *
   * @example
   * ```typescript
   * const result = schema.safeValidate(data)
   * if (result.success) {
   *   console.log(result.value)
   * } else {
   *   console.error(result.reason.issues)
   * }
   * ```
   */
  safeValidate<I>(
    input: I,
    options?: ValidateOptions,
  ): ValidationResult<I & InferInput<this>> {
    return ValidationContext.validate(input, this, {
      ...options,
      mode: 'validate',
    })
  }

  // @NOTE Dollar-prefixed aliases
  //
  // The built lexicons namespaces export utility functions that allow accessing
  // the schema's methods without the need to specify ".main." as part of the
  // namespace. This way, a utility for a particular record type can be called
  // like "app.bsky.feed.post.<utility>()" instead of
  // "app.bsky.feed.post.main.<utility>()". Because those utilities could
  // conflict with other schemas (e.g. if there is a lexicon definition at
  // "#<utility>"), those exported utilities will be prefixed with "$". In order
  // to be able to consistently call the utilities, when using the "main" and
  // non "main" definitions, we also expose the same methods with a "$" prefix.
  // Thanks to this, both of the following call will be possible:
  //
  // - "app.bsky.feed.post.$parse(...)" // calls a utility function created by "lex build"
  // - "app.bsky.feed.defs.postView.$parse(...)" // uses the alias defined below on the schema instance

  /**
   * Alias for {@link assert} with `$` prefix for namespace compatibility.
   *
   * @see {@link assert}
   */
  $assert(input: unknown): asserts input is InferInput<this> {
    return this.assert(input)
  }

  /**
   * Alias for {@link check} with `$` prefix for namespace compatibility.
   *
   * @see {@link check}
   */
  $check(input: unknown): void {
    return this.check(input)
  }

  /**
   * Alias for {@link cast} with `$` prefix for namespace compatibility.
   *
   * @see {@link cast}
   */
  $cast<I>(input: I): I & InferInput<this> {
    return this.cast(input)
  }

  /**
   * Alias for {@link matches} with `$` prefix for namespace compatibility.
   *
   * @see {@link matches}
   */
  $matches(input: unknown): input is InferInput<this> {
    return this.matches(input)
  }

  /**
   * Alias for {@link ifMatches} with `$` prefix for namespace compatibility.
   *
   * @see {@link ifMatches}
   */
  $ifMatches<I>(input: I): (I & InferInput<this>) | undefined {
    return this.ifMatches(input)
  }

  /**
   * Alias for {@link parse} with `$` prefix for namespace compatibility.
   *
   * @see {@link parse}
   */
  $parse(input: unknown, options?: ValidateOptions): InferOutput<this> {
    return this.parse(input, options)
  }

  /**
   * Alias for {@link safeParse} with `$` prefix for namespace compatibility.
   *
   * @see {@link safeParse}
   */
  $safeParse(
    input: unknown,
    options?: ValidateOptions,
  ): ValidationResult<InferOutput<this>> {
    return this.safeParse(input, options)
  }

  /**
   * Alias for {@link validate} with `$` prefix for namespace compatibility.
   *
   * @see {@link validate}
   */
  $validate<I>(input: I, options?: ValidateOptions): I & InferInput<this> {
    return this.validate(input, options)
  }

  /**
   * Alias for {@link safeValidate} with `$` prefix for namespace compatibility.
   *
   * @see {@link safeValidate}
   */
  $safeValidate<I>(
    input: I,
    options?: ValidateOptions,
  ): ValidationResult<I & InferInput<this>> {
    return this.safeValidate(input, options)
  }
}

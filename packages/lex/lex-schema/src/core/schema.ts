import { lazyProperty } from '../util/lazy-property.js'
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
 * schema.assert(123)         // Throws LexValidationError
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
   * Throws a {@link LexValidationError} if the input is invalid.
   *
   * @param input - The value to parse
   * @param options - Optional parsing configuration
   * @returns The parsed and potentially transformed value
   * @throws {LexValidationError} If the input fails validation
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
   * Throws a {@link LexValidationError} if the input is invalid or would require transformation.
   *
   * @typeParam I - The input type (preserved in the return type)
   * @param input - The value to validate
   * @param options - Optional validation configuration
   * @returns The validated input with narrowed type
   * @throws {LexValidationError} If the input fails validation or requires transformation
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
  // The `lex-builder` lib generates namespaced utility functions that allow
  // accessing the schema's methods without the need to specify the ".main."
  // part of the namespace. This allows utilities for a particular record type
  // to be called like "app.bsky.feed.post.<utility>()" instead of
  // "app.bsky.feed.post.main.<utility>()".
  //
  // Because those utilities could conflict with other schemas (e.g. if there is
  // a lexicon definition with the same name as the "<utility>"), those exported
  // utilities will be prefixed with "$".
  //
  // Similarly, since those utilities are defined as simple "const", they are
  // also bound (using JS's .bind) to the schema instance, so that they can be
  // used without worrying about the context (e.g. "app.bsky.feed.post.$parse()"
  // will work regardless of how it is imported or called).
  //
  // In order to provide the same functionalities for non-main definitions, we
  // also define those aliases directly on the schema instance, so that they can
  // be used in the same way as the utilities generated by "lex-builder". For
  // example, if there is a non-main definition "app.bsky.feed.defs.postView",
  // it will also be possible to call "app.bsky.feed.defs.postView.$parse()".
  //
  // These methods are also "bound" to the instance so that they can be used
  // exactly like the utilities generated by "lex-builder", without worrying
  // about the context.
  //
  // There are two ways we could "bind" those methods to the instance:
  // 1. Define them as getters that return the bound method (e.g. get $parse() {
  //    return this.parse.bind(this) })
  // 2. Define them as properties that are initialized in the constructor (e.g.
  //    this.$parse = this.parse.bind(this))
  //
  // Since a **lot** of those methods would end-up being created in systems that
  // contains many schemas (e.g. the appview), we choose the first approach
  // (getters) in order to avoid the overhead of creating all those bound
  // functions upfront when instantiating the schemas.

  /**
   * Bound alias for {@link assert} for compatibility with generated utilities.
   * @see {@link assert}
   */
  get $assert() {
    return lazyProperty(this, '$assert', this.assert.bind(this))
  }

  /**
   * Bound alias for {@link check} for compatibility with generated utilities.
   * @see {@link check}
   */
  get $check() {
    return lazyProperty(this, '$check', this.check.bind(this))
  }

  /**
   * Bound alias for {@link cast} for compatibility with generated utilities.
   * @see {@link cast}
   */
  get $cast() {
    return lazyProperty(this, '$cast', this.cast.bind(this))
  }

  /**
   * Bound alias for {@link matches} for compatibility with generated utilities.
   * @see {@link matches}
   */
  get $matches() {
    return lazyProperty(this, '$matches', this.matches.bind(this))
  }

  /**
   * Bound alias for {@link ifMatches} for compatibility with generated utilities.
   * @see {@link ifMatches}
   */
  get $ifMatches() {
    return lazyProperty(this, '$ifMatches', this.ifMatches.bind(this))
  }

  /**
   * Bound alias for {@link parse} for compatibility with generated utilities.
   * @see {@link parse}
   */
  get $parse() {
    return lazyProperty(this, '$parse', this.parse.bind(this))
  }

  /**
   * Bound alias for {@link safeParse} for compatibility with generated utilities.
   * @see {@link safeParse}
   */
  get $safeParse() {
    return lazyProperty(this, '$safeParse', this.safeParse.bind(this))
  }

  /**
   * Bound alias for {@link validate} for compatibility with generated utilities.
   * @see {@link validate}
   */
  get $validate() {
    return lazyProperty(this, '$validate', this.validate.bind(this))
  }

  /**
   * Bound alias for {@link safeValidate} for compatibility with generated utilities.
   * @see {@link safeValidate}
   */
  get $safeValidate() {
    return lazyProperty(this, '$safeValidate', this.safeValidate.bind(this))
  }
}

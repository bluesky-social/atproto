import {
  InferInput,
  InferOutput,
  ValidationContext,
  ValidationOptions,
  ValidationResult,
  Validator,
} from './validator.js'

type ParseOptions = Omit<ValidationOptions, 'mode'>
type ValidateOptions = Omit<ValidationOptions, 'mode'>

export interface SchemaInternals<out TInput = unknown, out TOutput = TInput> {
  /** @internal The inferred validation type */
  input: TInput

  /** @internal The inferred parse type */
  output: TOutput
}

export abstract class Schema<
  out TInput = unknown,
  out TOutput = TInput,
  out TInternals extends SchemaInternals<TInput, TOutput> = SchemaInternals<
    TInput,
    TOutput
  >,
> implements Validator<TInternals['input'], TInternals['output']>
{
  declare readonly ['__lex']: TInternals

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

  matches<I>(input: I): input is I & InferInput<this> {
    const result = ValidationContext.validate(input, this)
    return result.success
  }

  ifMatches<I>(input: I): (I & InferInput<this>) | undefined {
    return this.matches(input) ? input : undefined
  }

  parse(input: unknown, options?: ParseOptions): InferOutput<this> {
    const result = this.safeParse(input, options)
    if (result.success) return result.value
    throw result.reason
  }

  safeParse(
    input: unknown,
    options?: ParseOptions,
  ): ValidationResult<InferOutput<this>> {
    return ValidationContext.validate(input, this, {
      ...options,
      mode: 'parse',
    })
  }

  validate<I>(input: I, options?: ValidateOptions): I & InferInput<this> {
    const result = this.safeValidate(input, options)
    if (result.success) return result.value
    throw result.reason
  }

  safeValidate<I>(
    input: I,
    options?: ValidateOptions,
  ): ValidationResult<I & InferInput<this>> {
    return ValidationContext.validate(input, this, {
      ...options,
      mode: 'validate',
    })
  }

  // @NOTE The built lexicons namespaces will export utility functions that
  // allow accessing the schema's methods without the need to specify ".main."
  // as part of the namespace. This way, a utility for a particular record type
  // can be called like "app.bsky.feed.post.<utility>()" instead of
  // "app.bsky.feed.post.main.<utility>()". Because those utilities could
  // conflict with other schemas (e.g. if there is a lexicon definition at
  // "#<utility>"), those exported utilities will be prefixed with "$". In order
  // to be able to consistently call the utilities, when using the "main" and
  // non "main" definitions, we also expose the same methods with a "$" prefix.
  // Thanks to this, both of the following call will be possible:
  //
  // - "app.bsky.feed.post.$parse(...)" // calls a utility function created by "lex build"
  // - "app.bsky.feed.defs.postView.$parse(...)" // uses the alias defined below on the schema instance

  $assert(input: unknown): asserts input is InferInput<this> {
    return this.assert(input)
  }

  $check(input: unknown): void {
    return this.check(input)
  }

  $cast<I>(input: I): I & InferInput<this> {
    return this.cast(input)
  }

  $matches(input: unknown): input is InferInput<this> {
    return this.matches(input)
  }

  $ifMatches<I>(input: I): (I & InferInput<this>) | undefined {
    return this.ifMatches(input)
  }

  $parse(input: unknown, options?: ValidateOptions): InferOutput<this> {
    return this.parse(input, options)
  }

  $safeParse(
    input: unknown,
    options?: ValidateOptions,
  ): ValidationResult<InferOutput<this>> {
    return this.safeParse(input, options)
  }

  $validate<I>(input: I, options?: ValidateOptions): I & InferInput<this> {
    return this.validate(input, options)
  }

  $safeValidate<I>(
    input: I,
    options?: ValidateOptions,
  ): ValidationResult<I & InferInput<this>> {
    return this.safeValidate(input, options)
  }
}

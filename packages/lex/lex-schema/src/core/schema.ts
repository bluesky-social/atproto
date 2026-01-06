import {
  ValidationOptions,
  ValidationResult,
  Validator,
  ValidatorContext,
} from './validator.js'

export abstract class Schema<Output = any> implements Validator<Output> {
  declare readonly ['__lex']: { output: Output }

  abstract validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Output>

  /**
   * @note use {@link check}() instead of {@link assert}() if you encounter a
   * `ts(2775)` error and you are not able to fully type the validator. This
   * will typically arise in generic contexts, where the narrowed type is not
   * needed.
   */
  assert(input: unknown): asserts input is Output {
    const result = this.safeParse(input, { allowTransform: false })
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
   * `allowTransform: false`.
   */
  cast<I>(input: I): I & Output {
    return this.parse(input, { allowTransform: false })
  }

  matches(input: unknown): input is Output {
    const result = this.safeParse(input, { allowTransform: false })
    return result.success
  }

  ifMatches<I>(input: I): (I & Output) | undefined {
    return this.matches(input) ? input : undefined
  }

  parse<I>(
    input: I,
    options: ValidationOptions & { allowTransform: false },
  ): I & Output
  parse(input: unknown, options?: ValidationOptions): Output
  parse(input: unknown, options?: ValidationOptions): Output {
    const result = this.safeParse(input, options)
    if (!result.success) throw result.reason
    return result.value
  }

  safeParse<I>(
    input: I,
    options: ValidationOptions & { allowTransform: false },
  ): ValidationResult<I & Output>
  safeParse(
    input: unknown,
    options?: ValidationOptions,
  ): ValidationResult<Output>
  safeParse(
    input: unknown,
    options?: ValidationOptions,
  ): ValidationResult<Output> {
    return ValidatorContext.validate(input, this, options)
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

  $assert(input: unknown): asserts input is Output {
    return this.assert(input)
  }

  $matches(input: unknown): input is Output {
    return this.matches(input)
  }

  $ifMatches<I>(input: I): (I & Output) | undefined {
    return this.ifMatches(input)
  }

  $parse(input: unknown, options?: ValidationOptions): Output {
    return this.parse(input, options)
  }

  $safeParse(
    input: unknown,
    options?: ValidationOptions,
  ): ValidationResult<Output> {
    return this.safeParse(input, options)
  }
}

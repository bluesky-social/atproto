import { Issue, IssueTooBig, IssueTooSmall, stringifyIssue } from './issue.js'
import { PropertyKey } from './util.js'

export type SuccessResult<V = any> = { success: true; value: V }
export type FailureResult = { success: false; error: ValidationError }

export type ValidationResult<Value = any> = SuccessResult<Value> | FailureResult

export type Infer<T extends Validator> =
  T extends Validator<infer V> ? V : never

export class ValidationError extends Error {
  name = 'ValidationError'

  constructor(
    readonly issues: Issue[],
    options?: ErrorOptions,
  ) {
    super(issues.map(stringifyIssue).join(', '), options)
  }

  static fromFailures(failures: FailureResult[]): ValidationError {
    if (failures.length === 1) return failures[0].error
    return new ValidationError(failures.flatMap(extractFailureIssues))
  }
}

function extractFailureIssues(result: FailureResult): Issue[] {
  return result.error.issues
}

export abstract class Validator<V = any> {
  /**
   * @internal
   *
   * Do not call directly. Use `$is`,`$parse`, `$assert` or `$validate` instead.
   *
   * This method should be implemented by subclasses to perform validation and
   * transformation of the input value.
   *
   * By convention, the {@link ValidationResult} should return the original
   * input value if validation was successful and no transformation was applied
   * (i.e. the input already conformed to the schema). If a default value or
   * other transformation was applied, the returned value should be the new
   * value.
   *
   * This convention allows the `$is` and `$assert` methods to check whether the
   * input value exactly matches the schema (without defaults or
   * transformations), by checking if the returned value is strictly equal to
   * the input.
   */
  protected abstract validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<V>

  is<T>(input: T): input is T & V {
    const result = ValidationContext.validate(input, this, {
      allowTransform: false,
    })
    return result.success
  }

  parse(input: unknown, options?: ValidationOptions): V {
    const result = ValidationContext.validate(input, this, options)
    if (!result.success) throw result.error
    return result.value
  }

  assert(input: unknown): asserts input is V {
    const result = ValidationContext.validate(input, this, {
      allowTransform: false,
    })
    if (!result.success) throw result.error
  }

  validate(input: unknown, options?: ValidationOptions): ValidationResult<V> {
    return ValidationContext.validate(input, this, options)
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

  $is<T>(input: T): input is T & V {
    return this.is<T>(input)
  }

  $parse(input: unknown, options?: ValidationOptions): V {
    return this.parse(input, options)
  }

  $assert(input: unknown): asserts input is V {
    this.assert(input)
  }

  $validate(input: unknown, options?: ValidationOptions): ValidationResult<V> {
    return this.validate(input, options)
  }
}

type ValidationOptions = {
  path?: PropertyKey[]

  /** @default true */
  allowTransform?: boolean
}

export class ValidationContext {
  static validate<V>(
    input: unknown,
    validator: Validator<V>,
    options?: ValidationOptions,
  ): ValidationResult<V> {
    const context = new ValidationContext(options)
    return context.validate(input, validator)
  }

  #path: PropertyKey[]

  protected constructor(readonly options?: ValidationOptions) {
    // Create a copy because we will be mutating the path
    this.#path = options?.path ? [...options.path] : []
  }

  get path() {
    return [...this.#path]
  }

  get allowTransform() {
    return this.options?.allowTransform !== false
  }

  validate<V>(input: unknown, validator: Validator<V>): ValidationResult<V> {
    // @ts-expect-error validateInContext is abstract because it is @internal
    // (and meant to be called only from here).
    const result = validator.validateInContext(input, this)

    // If the value changed, it means that a default or transformation was
    // applied, meaning that the original value did *not* match the (output)
    // schema. When "allowTransform" is false, we consider this a failure.
    if (result.success && result.value !== input && !this.allowTransform) {
      return this.issueInvalidValue(input, [result.value])
    }

    return result
  }

  validateChild<I extends object, K extends PropertyKey & keyof I, V>(
    input: I,
    key: K,
    validator: Validator<V>,
  ): ValidationResult<V> {
    // Instead of creating a new context, we just push/pop the path segment.
    this.#path.push(key)
    try {
      return this.validate(input[key], validator)
    } finally {
      this.#path.length--
    }
  }

  success<V>(value: V): ValidationResult<V> {
    return { success: true, value }
  }

  failure(issue: Issue): FailureResult {
    return { success: false, error: new ValidationError([issue]) }
  }

  issueInvalidFormat(input: unknown, format: string, message?: string) {
    return this.failure({
      code: 'invalid_format',
      message,
      format,
      input,
      path: [...this.#path],
    })
  }

  issueInvalidValue(input: unknown, values: readonly unknown[]) {
    return this.failure({
      code: 'invalid_value',
      input,
      values,
      path: [...this.#path],
    })
  }

  issueInvalidType(input: unknown, expected: string) {
    return this.failure({
      code: 'invalid_type',
      input,
      expected,
      path: [...this.#path],
    })
  }

  issueInvalidPropertyValue<I>(
    input: I,
    property: keyof I & PropertyKey,
    values: readonly unknown[],
  ): FailureResult {
    return this.failure({
      code: 'invalid_value',
      values,
      input: input[property],
      path: [...this.#path, property],
    })
  }

  issueInvalidPropertyType<I>(
    input: I,
    property: keyof I & PropertyKey,
    expected: string,
  ): FailureResult {
    return this.failure({
      code: 'invalid_type',
      expected,
      input: input[property],
      path: [...this.#path, property],
    })
  }

  issueRequiredKey(input: object, key: PropertyKey) {
    return this.failure({
      code: 'required_key',
      key,
      input,
      path: [...this.#path, key],
    })
  }

  issueTooBig(
    input: unknown,
    type: IssueTooBig['type'],
    maximum: number,
    actual: number,
  ) {
    return this.failure({
      code: 'too_big',
      type,
      maximum,
      actual,
      input,
      path: [...this.#path],
    })
  }

  issueTooSmall(
    input: unknown,
    type: IssueTooSmall['type'],
    minimum: number,
    actual: number,
  ) {
    return this.failure({
      code: 'too_small',
      type,
      minimum,
      actual,
      input,
      path: [...this.#path],
    })
  }
}

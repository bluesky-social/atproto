import { PropertyKey } from './property-key.js'
import { FailureResult, ValidationError } from './validation-error.js'
import {
  IssueTooBig,
  IssueTooSmall,
  ValidationIssue,
} from './validation-issue.js'

export type SuccessResult<V = any> = { success: true; value: V }

export type ValidationResult<Value = any> = SuccessResult<Value> | FailureResult

type ValidationOptions = {
  path?: PropertyKey[]

  /** @default true */
  allowTransform?: boolean
}

export type Infer<T extends Validator> = T['_lex']['output']

export abstract class Validator<Output = any> {
  /**
   * @internal **INTERNAL API, DO NOT USE**.
   *
   * This property is used for type inference purposes and does not actually
   * exist at runtime.
   */
  _lex!: { output: Output }

  readonly lexiconType?: string

  /**
   * @internal **INTERNAL API, DO NOT USE**.
   *
   * Use {@link Validator.assert assert}, {@link Validator.check check},
   * {@link Validator.parse parse} or {@link Validator.validate validate}
   * instead.
   *
   * This method is implemented by subclasses to perform transformation and
   * validation of the input value. Do not call this method directly; as the
   * {@link ValidationContext.options.allowTransform} option will **not** be
   * enforced. See {@link ValidationContext.validate} for details. When
   * delegating validation from one validator sub-class implementation to
   * another schema, {@link ValidationContext.validate} should be used instead
   * of calling {@link Validator.validateInContext}. This will allow to stop the
   * validation process if the value was transformed (by the other schema) but
   * transformations are not allowed.
   *
   * By convention, the {@link ValidationResult} must return the original input
   * value if validation was successful and no transformation was applied (i.e.
   * the input already conformed to the schema). If a default value, or any
   * other transformation was applied, the returned value c&an be different from
   * the input.
   *
   * This convention allows the {@link Validator.check check} and
   * {@link Validator.assert assert} methods to check whether the input value
   * exactly matches the schema (without defaults or transformations), by
   * checking if the returned value is strictly equal to the input.
   *
   * @see {@link ValidationContext.validate}
   */
  abstract validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Output>

  assert(input: unknown): asserts input is Output {
    const result = this.validate(input, { allowTransform: false })
    if (!result.success) throw result.error
  }

  check(input: unknown): input is Output {
    const result = this.validate(input, { allowTransform: false })
    return result.success
  }

  maybe<I>(input: I): (I & Output) | undefined {
    return this.check(input) ? input : undefined
  }

  parse<I>(
    input: I,
    options: ValidationOptions & { allowTransform: false },
  ): I & Output
  parse(input: unknown, options?: ValidationOptions): Output
  parse(input: unknown, options?: ValidationOptions): Output {
    const result = ValidationContext.validate(input, this, options)
    if (!result.success) throw result.error
    return result.value
  }

  validate<I>(
    input: I,
    options: ValidationOptions & { allowTransform: false },
  ): ValidationResult<I & Output>
  validate(
    input: unknown,
    options?: ValidationOptions,
  ): ValidationResult<Output>
  validate(
    input: unknown,
    options?: ValidationOptions,
  ): ValidationResult<Output> {
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

  $assert(input: unknown): asserts input is Output {
    return this.assert(input)
  }

  $check(input: unknown): input is Output {
    return this.check(input)
  }

  $maybe<I>(input: I): (I & Output) | undefined {
    return this.maybe(input)
  }

  $parse(input: unknown, options?: ValidationOptions): Output {
    return this.parse(input, options)
  }

  $validate(
    input: unknown,
    options?: ValidationOptions,
  ): ValidationResult<Output> {
    return this.validate(input, options)
  }
}

export class ValidationContext {
  /**
   * Creates a new validation context and validates the input using the
   * provided validator.
   */
  static validate<V>(
    input: unknown,
    validator: Validator<V>,
    options: ValidationOptions = {},
  ): ValidationResult<V> {
    const context = new ValidationContext(options)
    return context.validate(input, validator)
  }

  private readonly currentPath: PropertyKey[]
  private readonly issues: ValidationIssue[] = []

  protected constructor(readonly options: ValidationOptions) {
    // Create a copy because we will be mutating the array during validation.
    this.currentPath = options?.path ? [...options.path] : []
  }

  get path() {
    return [...this.currentPath]
  }

  get allowTransform() {
    // Default to true
    return this.options?.allowTransform !== false
  }

  /**
   * This is basically the entry point for validation within a context. Use this
   * method instead of {@link Validator.validateInContext} directly, because
   * this method enforces the {@link ValidationOptions.allowTransform} option.
   */
  validate<V>(input: unknown, validator: Validator<V>): ValidationResult<V> {
    const result = validator.validateInContext(input, this)

    if (this.issues.length > 0) {
      const issues = result.success
        ? [...this.issues]
        : [...this.issues, ...result.error.issues]
      return { success: false, error: new ValidationError(issues) }
    }

    // If the value changed, it means that a default (or some other
    // transformation) was applied, meaning that the original value did *not*
    // match the (output) schema. When "allowTransform" is false, we consider
    // this a failure.

    // This check is the reason why Validator.validateInContext should not be
    // used directly.
    if (
      result.success &&
      !this.allowTransform &&
      !Object.is(result.value, input)
    ) {
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
    this.currentPath.push(key)
    try {
      return this.validate(input[key], validator)
    } finally {
      this.currentPath.length--
    }
  }

  addIssue(
    issue: {
      [Code in ValidationIssue['code']]: Omit<
        Extract<ValidationIssue, { code: Code }>,
        'path'
      > & { path?: PropertyKey[] }
    }[ValidationIssue['code']],
  ): void {
    this.issues.push({
      ...issue,
      path: issue.path
        ? [...this.currentPath, ...issue.path]
        : [...this.currentPath],
    } as ValidationIssue)
  }

  success<V>(value: V): ValidationResult<V> {
    return { success: true, value }
  }

  failure(issue: ValidationIssue): FailureResult {
    return { success: false, error: new ValidationError([issue]) }
  }

  issueInvalidValue(
    input: unknown,
    values: readonly unknown[],
    path?: PropertyKey | readonly PropertyKey[],
  ) {
    return this.failure({
      code: 'invalid_value',
      input,
      values,
      path: path ? this.currentPath.concat(path) : [...this.currentPath],
    })
  }

  issueInvalidType(
    input: unknown,
    expected: string | readonly string[],
    path?: PropertyKey | readonly PropertyKey[],
  ) {
    return this.failure({
      code: 'invalid_type',
      input,
      expected: Array.isArray(expected) ? expected : [expected],
      path: path ? this.currentPath.concat(path) : [...this.currentPath],
    })
  }

  issueInvalidPropertyValue<I>(
    input: I,
    property: keyof I & PropertyKey,
    values: readonly unknown[],
  ): FailureResult {
    return this.issueInvalidValue(input[property], values, property)
  }

  issueInvalidPropertyType<I>(
    input: I,
    property: keyof I & PropertyKey,
    expected: string | readonly string[],
  ): FailureResult {
    return this.issueInvalidType(input[property], expected, property)
  }

  issueRequiredKey(input: object, key: PropertyKey) {
    return this.failure({
      code: 'required_key',
      key,
      input,
      path: [...this.currentPath, key],
    })
  }

  issueInvalidFormat(input: unknown, format: string, message?: string) {
    return this.failure({
      code: 'invalid_format',
      message,
      format,
      input,
      path: [...this.currentPath],
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
      path: [...this.currentPath],
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
      path: [...this.currentPath],
    })
  }

  custom(input: unknown, message: string) {
    return this.failure({
      code: 'custom',
      input,
      message,
      path: [...this.currentPath],
    })
  }
}

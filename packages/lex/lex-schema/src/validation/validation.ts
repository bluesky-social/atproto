import { PropertyKey } from './property-key.js'
import { FailureResult, ValidationError } from './validation-error.js'
import {
  IssueTooBig,
  IssueTooSmall,
  ValidationIssue,
} from './validation-issue.js'

export type SuccessResult<V = any> = { success: true; value: V }

export type ValidationResult<Value = any> = SuccessResult<Value> | FailureResult

export type Infer<T extends Validator> =
  T extends Validator<infer V> ? V : never

type ValidationOptions = {
  path?: PropertyKey[]

  /** @default true */
  allowTransform?: boolean
}

export abstract class Validator<V = any> {
  readonly lexiconType?: string

  /**
   * @internal **DO NOT CALL THIS METHOD DIRECTLY**
   *
   * Use `is`,`parse`, `assert` or `validate` instead.
   *
   * This method should be implemented by subclasses to perform validation and
   * transformation of the input value.
   *
   * By convention, the {@link ValidationResult} must return the original input
   * value if validation was successful and no transformation was applied (i.e.
   * the input already conformed to the schema). If a default value, or any
   * other transformation was applied, the returned value c&an be different from
   * the input.
   *
   * This convention allows the `matches` and `assert` methods to check whether
   * the input value exactly matches the schema (without defaults or
   * transformations), by checking if the returned value is strictly equal to
   * the input.
   */
  protected abstract validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<V>

  assert(input: unknown): asserts input is V {
    const result = this.validate(input, { allowTransform: false })
    if (!result.success) throw result.error
  }

  matches(input: unknown): input is V {
    const result = this.validate(input, { allowTransform: false })
    return result.success
  }

  maybe<T>(input: T): (T & V) | undefined {
    return this.matches(input) ? input : undefined
  }

  parse(input: unknown, options?: ValidationOptions): V {
    const result = this.validate(input, options)
    if (!result.success) throw result.error
    return result.value
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

  $assert(input: unknown): asserts input is V {
    return this.assert(input)
  }

  $matches(input: unknown): input is V {
    return this.matches(input)
  }

  $maybe<T>(input: T): (T & V) | undefined {
    return this.maybe(input)
  }

  $parse(input: unknown, options?: ValidationOptions): V {
    return this.parse(input, options)
  }

  $validate(input: unknown, options?: ValidationOptions): ValidationResult<V> {
    return this.validate(input, options)
  }
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

  private readonly currentPath: PropertyKey[]

  protected constructor(readonly options?: ValidationOptions) {
    // Create a copy because we will be mutating the array during validation.
    this.currentPath = options?.path ? [...options.path] : []
  }

  get path() {
    return [...this.currentPath]
  }

  get allowTransform() {
    return this.options?.allowTransform !== false
  }

  validate<V>(input: unknown, validator: Validator<V>): ValidationResult<V> {
    // @ts-expect-error validateInContext is abstract because it is @internal
    // (and meant to be called only from here).
    const result = validator.validateInContext(input, this)

    // If the value changed, it means that a default (or some other
    // transformation) was applied, meaning that the original value did *not*
    // match the (output) schema. When "allowTransform" is false, we consider
    // this a failure.
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
}

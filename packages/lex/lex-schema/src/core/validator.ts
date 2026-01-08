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

export type ValidationSuccess<Value = any> = ResultSuccess<Value>
export type ValidationFailure = ResultFailure<ValidationError>
export type ValidationResult<Value = any> =
  | ValidationSuccess<Value>
  | ValidationFailure

export type ValidationOptions = {
  path?: PropertyKey[]

  /** @default true */
  allowTransform?: boolean
}

export type Infer<T extends Validator> = T['__lex']['output']

export interface Validator<Output = any> {
  /**
   * This property is used for type inference purposes and does not actually
   * exist at runtime.
   *
   * @deprecated **INTERNAL API, DO NOT USE**.
   */
  readonly ['__lex']: { output: Output }

  /**
   * @internal **INTERNAL API**: use {@link ValidatorContext.validate} instead
   *
   * This method is implemented by subclasses to perform transformation and
   * validation of the input value. Do not call this method directly; as the
   * {@link ValidatorContext.options.allowTransform} option will **not** be
   * enforced. See {@link ValidatorContext.validate} for details. When
   * delegating validation from one validator sub-class implementation to
   * another schema, {@link ValidatorContext.validate} must be used instead of
   * calling {@link Validator.validateInContext}. This will allow to stop the
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
   * @see {@link ValidatorContext.validate}
   */
  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Output>
}

export class ValidatorContext {
  /**
   * Creates a new validation context and validates the input using the
   * provided validator.
   */
  static validate<V>(
    input: unknown,
    validator: Validator<V>,
    options: ValidationOptions = {},
  ): ValidationResult<V> {
    const context = new ValidatorContext(options)
    return context.validate(input, validator)
  }

  private readonly currentPath: PropertyKey[]
  private readonly issues: Issue[] = []

  protected constructor(readonly options: ValidationOptions) {
    // Create a copy because we will be mutating the array during validation.
    this.currentPath = options?.path != null ? Array.from(options.path) : []
  }

  get path() {
    return Array.from(this.currentPath)
  }

  concatPath(path?: PropertyKey | readonly PropertyKey[]) {
    if (path == null) return this.path
    return this.currentPath.concat(path)
  }

  /**
   * This is basically the entry point for validation within a context. Use this
   * method instead of {@link Validator.validateInContext} directly, because
   * this method enforces the {@link ValidationOptions.allowTransform} option.
   */
  validate<V>(input: unknown, validator: Validator<V>): ValidationResult<V> {
    // This is the only place where validateInContext should be called.
    const result = validator.validateInContext(input, this)

    if (result.success) {
      if (
        // Defaults to true
        this.options?.allowTransform === false &&
        !Object.is(result.value, input)
      ) {
        // If the value changed, it means that a default (or some other
        // transformation) was applied, meaning that the original value did
        // *not* match the (output) schema. When "allowTransform" is false, we
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

      if (this.issues.length > 0) {
        // Validator returned a success but issues were added via the context.
        // This means the overall validation failed.
        return failure(new ValidationError(Array.from(this.issues)))
      }
    }

    return result as ValidationResult<V>
  }

  validateChild<
    I extends object,
    K extends PropertyKey & keyof I,
    V extends Validator,
  >(input: I, key: K, validator: V): ValidationResult<Infer<V>> {
    // Instead of creating a new context, we just push/pop the path segment.
    this.currentPath.push(key)
    try {
      return this.validate(input[key], validator)
    } finally {
      this.currentPath.length--
    }
  }

  addIssue(issue: Issue): void {
    this.issues.push(issue)
  }

  success<V>(value: V): ValidationResult<V> {
    return success(value)
  }

  failure(reason: ValidationError): ValidationFailure {
    return failure(reason)
  }

  issue(issue: Issue) {
    return this.failure(new ValidationError([...this.issues, issue]))
  }

  issueInvalidValue(input: unknown, values: readonly unknown[]) {
    return this.issue(new IssueInvalidValue(this.path, input, values))
  }

  issueInvalidType(input: unknown, expected: string) {
    return this.issue(new IssueInvalidType(this.path, input, [expected]))
  }

  issueRequiredKey(input: object, key: PropertyKey) {
    return this.issue(new IssueRequiredKey(this.path, input, key))
  }

  issueInvalidFormat(input: unknown, format: string, msg?: string) {
    return this.issue(new IssueInvalidFormat(this.path, input, format, msg))
  }

  issueTooBig(
    input: unknown,
    type: MeasurableType,
    max: number,
    actual: number,
  ) {
    return this.issue(new IssueTooBig(this.path, input, max, type, actual))
  }

  issueTooSmall(
    input: unknown,
    type: MeasurableType,
    min: number,
    actual: number,
  ) {
    return this.issue(new IssueTooSmall(this.path, input, min, type, actual))
  }

  issueInvalidPropertyValue<I>(
    input: I,
    property: keyof I & PropertyKey,
    values: readonly unknown[],
  ) {
    const value = input[property]
    const path = this.concatPath(property)
    return this.issue(new IssueInvalidValue(path, value, values))
  }

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

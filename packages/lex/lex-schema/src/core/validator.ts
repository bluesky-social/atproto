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

export type ValidationSuccess<Value = unknown> = ResultSuccess<Value>
export type ValidationFailure = ResultFailure<ValidationError>
export type ValidationResult<Value = unknown> =
  | ValidationSuccess<Value>
  | ValidationFailure

export type InferInput<V extends Validator> = V['__lex']['input']
export type InferOutput<V extends Validator> = V['__lex']['output']

export type { InferInput as Infer }

export interface Validator<TInput = unknown, TOutput = TInput> {
  /**
   * This property is used for type inference purposes and does not actually
   * exist at runtime.
   *
   * @deprecated **INTERNAL API, DO NOT USE**.
   */
  readonly ['__lex']: {
    /** @internal The inferred validation type */
    input: TInput
    /** @internal The inferred parse type */
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

export type ValidationOptions = {
  /**
   * When set to `"validate"` (default), the result of validation must be
   * strictly equal to the input value (i.e. no transformation, such as applying
   * default values, is allowed).
   */
  mode?: 'validate' | 'parse'

  /**
   * The path to the value being validated. This is used to provide more
   * context in validation issues.
   */
  path?: readonly PropertyKey[]
}

export class ValidationContext {
  static validate<V extends Validator>(
    input: unknown,
    validator: V,
    options: ValidationOptions & {
      mode: 'parse'
    },
  ): ValidationResult<InferOutput<V>>
  static validate<V extends Validator, I = unknown>(
    input: I,
    validator: V,
    options?: ValidationOptions & {
      mode?: 'validate'
    },
  ): ValidationResult<I & InferInput<V>>
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

  protected readonly currentPath: PropertyKey[]
  protected readonly issues: Issue[] = []

  constructor(readonly options: Required<ValidationOptions>) {
    // Create a copy because we will be mutating the array during validation.
    this.currentPath = Array.from(options.path)
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
   * method instead of using {@link Validator.validateInContext} directly,
   * because this method ensures the proper use of {@link ValidationOptions}.
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

  validateChild<
    I extends object,
    K extends PropertyKey & keyof I,
    V extends Validator,
  >(input: I, key: K, validator: V): ValidationResult<InferInput<V>> {
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

export type UnwrapValidator<T extends Validator> = T extends {
  unwrap(): infer U extends Validator
}
  ? UnwrapValidator<U>
  : T

export interface WrappedValidator<out Validator> {
  unwrap(): Validator
}

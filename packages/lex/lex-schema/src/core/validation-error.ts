import { LexError } from '@atproto/lex-data'
import { arrayAgg } from '../util/array-agg.js'
import { ResultFailure, failureReason } from './result.js'
import {
  Issue,
  IssueInvalidType,
  IssueInvalidValue,
} from './validation-issue.js'

/**
 * Error thrown when validation fails.
 *
 * Contains detailed information about all validation issues encountered,
 * including the path to each invalid value and descriptions of what was
 * expected vs what was received.
 *
 * Extends {@link LexError} with the error name "InvalidRequest" for
 * consistency with the AT Protocol error handling conventions.
 *
 * @example
 * ```typescript
 * const error = new ValidationError([
 *   new IssueInvalidType(['user', 'age'], 'hello', ['number'])
 * ])
 * console.log(error.message)
 * // "Expected number value type at $.user.age (got string)"
 *
 * console.log(error.issues.length) // 1
 * console.log(error.toJSON())
 * // { error: 'InvalidRequest', message: '...', issues: [...] }
 * ```
 */
export class ValidationError extends LexError {
  name = 'ValidationError'

  /**
   * The list of validation issues that caused this error.
   *
   * Issues are aggregated when possible (e.g., multiple invalid type issues
   * at the same path are combined into a single issue listing all expected types).
   */
  readonly issues: Issue[]

  /**
   * Creates a new validation error from a list of issues.
   *
   * Issues are automatically aggregated to combine related issues at the same
   * path (e.g., multiple type expectations from a union schema).
   *
   * @param issues - The validation issues that caused this error
   * @param options - Standard Error options (e.g., `cause`)
   */
  constructor(issues: Issue[], options?: ErrorOptions) {
    const issuesAgg = aggregateIssues(issues)
    super('InvalidRequest', issuesAgg.join(', '), options)
    this.issues = issuesAgg
  }

  /**
   * Converts the error to a JSON-serializable object.
   *
   * @returns An object containing the error details and all issues in JSON format
   */
  toJSON() {
    return {
      ...super.toJSON(),
      issues: this.issues.map((issue) => issue.toJSON()),
    }
  }

  /**
   * Creates a validation error by combining multiple validation failures.
   *
   * This is useful when validating against multiple possible schemas (e.g., unions)
   * and all branches fail. The resulting error contains issues from all failures.
   *
   * @param failures - The validation failures to combine
   * @returns A single validation error containing all issues from the failures
   *
   * @example
   * ```typescript
   * const failures = schemas.map(s => s.safeValidate(data)).filter(r => !r.success)
   * if (failures.length === schemas.length) {
   *   throw ValidationError.fromFailures(failures)
   * }
   * ```
   */
  static fromFailures(
    failures: ResultFailure<ValidationError>[],
  ): ValidationError {
    if (failures.length === 1) return failureReason(failures[0])
    const issues = failures.flatMap(extractFailureIssues)
    return new ValidationError(issues, {
      // Keep the original errors as the cause chain
      cause: failures.map(failureReason),
    })
  }
}

function extractFailureIssues(result: ResultFailure<ValidationError>) {
  return result.reason.issues
}

function aggregateIssues(issues: Issue[]): Issue[] {
  // Quick path for common cases
  if (issues.length <= 1) return issues
  if (issues.length === 2 && issues[0].code !== issues[1].code) return issues

  return [
    // Aggregate invalid_type with identical paths
    ...arrayAgg(
      issues.filter((issue) => issue instanceof IssueInvalidType),
      (a, b) => comparePropertyPaths(a.path, b.path),
      (issues) =>
        new IssueInvalidType(
          issues[0].path,
          issues[0].input,
          Array.from(new Set(issues.flatMap((iss) => iss.expected))),
        ),
    ),
    // Aggregate invalid_value with identical paths
    ...arrayAgg(
      issues.filter((issue) => issue instanceof IssueInvalidValue),
      (a, b) => comparePropertyPaths(a.path, b.path),
      (issues) =>
        new IssueInvalidValue(
          issues[0].path,
          issues[0].input,
          Array.from(new Set(issues.flatMap((iss) => iss.values))),
        ),
    ),
    // Pass through other issues
    ...issues.filter(
      (issue) =>
        !(issue instanceof IssueInvalidType) &&
        !(issue instanceof IssueInvalidValue),
    ),
  ]
}

/*@__NO_SIDE_EFFECTS__*/
function comparePropertyPaths(
  a: readonly PropertyKey[],
  b: readonly PropertyKey[],
) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

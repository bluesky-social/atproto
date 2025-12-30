import { LexError } from '@atproto/lex-data'
import { arrayAgg } from '../util/array-agg.js'
import { ResultFailure, failureReason } from './result.js'
import {
  Issue,
  IssueInvalidType,
  IssueInvalidValue,
} from './validation-issue.js'

export class ValidationError extends LexError {
  name = 'ValidationError'

  readonly issues: Issue[]

  constructor(issues: Issue[], options?: ErrorOptions) {
    const issuesAgg = aggregateIssues(issues)
    super('InvalidRequest', issuesAgg.join(', '), options)
    this.issues = issuesAgg
  }

  toJSON() {
    return {
      ...super.toJSON(),
      issues: this.issues.map((issue) => issue.toJSON()),
    }
  }

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

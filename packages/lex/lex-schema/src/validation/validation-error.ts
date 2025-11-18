import { ResultFailure, extractFailureError } from '../util/result.js'
import {
  ValidationIssue,
  aggregateIssues,
  stringifyIssue,
} from './validation-issue.js'

export class ValidationError extends Error {
  name = 'ValidationError'

  constructor(
    readonly issues: ValidationIssue[],
    options?: ErrorOptions,
  ) {
    super(issues.map(stringifyIssue).join(', '), options)
  }

  static fromFailures(
    failures: ResultFailure<ValidationError>[],
  ): ValidationError {
    if (failures.length === 1) return failures[0].error
    const issues = failures.flatMap(extractFailureIssues)
    return new ValidationError(aggregateIssues(issues), {
      // Keep the original errors as the cause chain
      cause: failures.map(extractFailureError),
    })
  }
}

function extractFailureIssues(result: ResultFailure<ValidationError>) {
  return result.error.issues
}

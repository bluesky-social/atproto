import { Issue, aggregateIssues, stringifyIssue } from './validation-issue.js'

export type FailureResult = { success: false; error: ValidationError }

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
    const issues = failures.flatMap(extractFailureIssues)
    return new ValidationError(aggregateIssues(issues), {
      // Keep the original errors as the cause chain
      cause: failures.map(extractFailureError),
    })
  }
}

function extractFailureError(result: FailureResult): ValidationError {
  return result.error
}

function extractFailureIssues(result: FailureResult): Issue[] {
  return result.error.issues
}

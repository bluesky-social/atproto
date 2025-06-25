import { ZodError, ZodIssue, ZodIssueCode } from 'zod'

export function formatZodError(err: ZodError, prefix?: string): string {
  const message = err.issues.length
    ? err.issues.map(formatZodIssue).join('; ')
    : err.message // Should never happen (issues should never be empty)
  return prefix ? `${prefix}: ${message}` : message
}

export function formatZodIssue(issue: ZodIssue): string {
  if (issue.code === ZodIssueCode.invalid_union) {
    return issue.unionErrors
      .map((err) => err.issues.map(formatZodIssue).join('; '))
      .join(', or ')
  }

  if (issue.path.length === 1 && typeof issue.path[0] === 'number') {
    return `${issue.message} at index ${issue.path[0]}`
  }

  if (issue.path.length) {
    return `${issue.message} at ${issue.path.join('.')}`
  }

  return issue.message
}

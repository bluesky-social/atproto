import { ZodError } from 'zod'

export function extractZodErrorMessage(err: unknown): string | undefined {
  if (err instanceof ZodError) {
    const issue = err.issues[0]
    if (issue?.path.length) {
      // "part" will typically be "body" or "query"
      const [part, ...path] = issue.path
      return `Validation of "${path.join('.')}" ${part} parameter failed: ${issue.message}`
    }
  }

  return undefined
}

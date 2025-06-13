import { ZodError } from 'zod'

export function extractZodErrorMessage(err: unknown): string | undefined {
  if (err instanceof ZodError) {
    for (const issue of err.issues) {
      if (issue.path.length) {
        // "part" will typically be "body" or "query"
        const [part, ...path] = issue.path
        const location = path.length ? `"${path.join('.')}" ${part}` : part
        const message = extractMessage(issue)
        return `Validation of ${location} parameter failed${message ? `: ${message}` : ''}`
      }
    }

    const message = extractMessage(err)
    return `Validation failed${message ? `: ${message}` : ''}`
  }

  return undefined
}

function extractMessage({ message }: { message: string }): string | undefined {
  // message serialization defaults to JSON.stringify(err.issues)
  if (!message.startsWith('[') && !message.endsWith(']')) {
    // If the error message does not end with ']', it means it is not a
    // serialization of the issues, so we can return it directly.
    return message
  }

  return undefined
}

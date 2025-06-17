import { ZodError } from 'zod'

export function extractZodErrorMessage(err: unknown): string | undefined {
  if (err instanceof ZodError) {
    for (const issue of err.issues) {
      if (issue.path.length) {
        // "part" will typically be "body" or "query"
        const [part, ...path] = issue.path
        const title = path.length
          ? `Validation of  "${path.join('.')}" ${part} parameter failed`
          : `Invalid request ${part}`
        const message = extractMessage(issue)
        return message ? `${title}: ${message}` : title
      }
    }

    const message = extractMessage(err)
    if (message) return `Invalid request: ${message}`
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

import { MessageDescriptor } from '@lingui/core'
import { toJsonSafe } from './util'

export type ParsedError = {
  name?: string
  code?: string
  message?: string
  payload?: string
  stack?: string

  /**
   * A user-friendly description of the error, suitable for display in the UI.
   */
  description?: MessageDescriptor
}

export type ErrorParser = (error: unknown) => ParsedError | void

export function parseError(error: unknown): ParsedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
    }
  }

  return {
    payload: toJsonSafe(error),
  }
}

export function composeErrorParsers(
  ...parsers: (ErrorParser | undefined)[]
): ErrorParser {
  return (error) => {
    for (const parser of parsers) {
      const parsed = parser?.(error)
      if (parsed) return parsed
    }
  }
}

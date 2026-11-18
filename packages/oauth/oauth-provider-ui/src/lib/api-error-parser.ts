import type { MessageDescriptor } from '@lingui/core'
import { OAuthErrorResponse, isOAuthErrorPayload } from '#/lib/api.ts'
import type { ParsedError } from './error-parser.ts'
import { JsonErrorResponse } from './json-client.ts'
import { toJsonSafe } from './util.ts'

export function apiErrorParser(error: unknown): ParsedError | void {
  if (error instanceof OAuthErrorResponse) {
    return {
      name: error.name,
      code: error.payload.error,
      message: error.payload.error_description,
      payload: toJsonSafe(error.payload),
      description: error.msg,
    }
  }

  // Errors identified by their status rather than by an OAuth payload (e.g.
  // RateLimitExceededError), which may not even come from the server itself
  if (error instanceof JsonErrorResponse) {
    return {
      name: error.name,
      code: isOAuthErrorPayload(error.payload)
        ? error.payload.error
        : undefined,
      message: error.message,
      payload: toJsonSafe(error.payload),
      description: error.msg,
    }
  }
}

export function apiErrorMessage(error: unknown): MessageDescriptor | undefined {
  if (error instanceof JsonErrorResponse) {
    return error.msg
  }
}

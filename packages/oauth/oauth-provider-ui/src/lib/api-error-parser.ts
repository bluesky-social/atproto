import type { MessageDescriptor } from '@lingui/core'
import type { ParsedError } from '#/components/utils/error-card.tsx'
import { OAuthErrorResponse } from '#/lib/api.ts'
import { JsonErrorResponse } from './json-client.ts'
import { toJsonSafe } from './util.ts'

export function apiErrorParser(error: unknown): ParsedError | void {
  if (error instanceof OAuthErrorResponse) {
    return {
      name: error.name,
      code: error.payload.error,
      message: error.payload.error_description,
      payload: toJsonSafe(error.payload),
      description: apiErrorMessage(error),
    }
  }
}

export function apiErrorMessage(error: unknown): MessageDescriptor | undefined {
  if (error instanceof JsonErrorResponse) {
    return error.msg
  }
}

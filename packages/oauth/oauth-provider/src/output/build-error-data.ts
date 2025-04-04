import { ErrorData } from '@atproto/oauth-provider-api'
import { buildErrorPayload } from './build-error-payload.js'

// @NOTE: The primary role of this function is to ensure that the ErrorPayload
// and ErrorData types are in sync.
export function buildErrorData(error: unknown): ErrorData {
  return buildErrorPayload(error)
}

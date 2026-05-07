import { createRetryable } from '@atproto/common'
import { XrpcError } from '@atproto/lex'

export const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

export const retryXrpc = createRetryable((err) => {
  return err instanceof XrpcError && err.shouldRetry()
})

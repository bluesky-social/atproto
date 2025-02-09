import { createRetryable } from '@atproto/common'
import { ResponseType, XRPCError } from '@atproto/xrpc'

export const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

export const retryXrpc = createRetryable((err: unknown) => {
  if (err instanceof XRPCError) {
    if (err.status === ResponseType.Unknown) return true
    return RETRYABLE_HTTP_STATUS_CODES.has(err.status)
  }
  return false
})

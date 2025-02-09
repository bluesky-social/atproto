import { z } from 'zod'
import { RequestId, requestIdSchema } from './request-id.js'

export const REQUEST_URI_PREFIX = 'urn:ietf:params:oauth:request_uri:'

export const requestUriSchema = z
  .string()
  .refinement(
    (data): data is `${typeof REQUEST_URI_PREFIX}${RequestId}` =>
      data.startsWith(REQUEST_URI_PREFIX) &&
      requestIdSchema.safeParse(decodeRequestUri(data as any)).success,
    {
      code: z.ZodIssueCode.custom,
      message: 'Invalid request_uri format',
    },
  )

export type RequestUri = z.infer<typeof requestUriSchema>

export function encodeRequestUri(requestId: RequestId): RequestUri {
  return `${REQUEST_URI_PREFIX}${encodeURIComponent(requestId) as RequestId}`
}

export function decodeRequestUri(requestUri: RequestUri): RequestId {
  const requestIdEnc = requestUri.slice(REQUEST_URI_PREFIX.length)
  return decodeURIComponent(requestIdEnc) as RequestId
}

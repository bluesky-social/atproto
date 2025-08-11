import { z } from 'zod'
import { RequestId, requestIdSchema } from './request-id.js'

export const REQUEST_URI_PREFIX = 'urn:ietf:params:oauth:request_uri:'

export const requestUriSchema = z.string().transform((data, ctx) => {
  if (!data.startsWith(REQUEST_URI_PREFIX)) {
    ctx.addIssue({
      code: 'custom',
      message: `Request URI must start with "${REQUEST_URI_PREFIX}"`,
    })
  }

  const requestId = decodeRequestUriUnsafe(data as RequestUri)
  if (!requestIdSchema.safeParse(requestId).success) {
    ctx.addIssue({
      code: 'custom',
      message: `Request URI must be a valid request ID`,
    })
  }

  return data as `${typeof REQUEST_URI_PREFIX}${RequestId}`
})

export type RequestUri = z.infer<typeof requestUriSchema>

export function encodeRequestUri(requestId: RequestId): RequestUri {
  return `${REQUEST_URI_PREFIX}${encodeURIComponent(requestId) as RequestId}`
}

export function decodeRequestUriUnsafe(requestUri: RequestUri): RequestId {
  const requestIdEnc = requestUri.slice(REQUEST_URI_PREFIX.length)
  return decodeURIComponent(requestIdEnc) as RequestId
}

import { z } from 'zod'
import { authorizationResponseErrorSchema } from './authorization-response-error.js'

// https://datatracker.ietf.org/doc/html/rfc9126#section-2.3-1
// > Since initial processing of the pushed authorization request does not
// > involve resource owner interaction, error codes related to user
// > interaction, such as "access_denied", are never returned.

export const parResponseErrorSchema = z.intersection(
  authorizationResponseErrorSchema,
  z.enum([
    'invalid_request',
    'unauthorized_client',
    'unsupported_response_type',
    'invalid_scope',
    'server_error',
    'temporarily_unavailable',
  ]),
)

export type PARResponseError = z.infer<typeof parResponseErrorSchema>

export function isPARResponseError<T>(value: T): value is T & PARResponseError {
  return parResponseErrorSchema.safeParse(value).success
}

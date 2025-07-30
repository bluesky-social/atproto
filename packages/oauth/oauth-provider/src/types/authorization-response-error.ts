import { z } from 'zod'
import {
  oauthAuthorizationResponseErrorSchema,
  oidcAuthorizationResponseErrorSchema,
} from '@atproto/oauth-types'

export const authorizationResponseErrorSchema = z.union([
  oauthAuthorizationResponseErrorSchema,
  // OIDC authentication error response are not part of the ATproto flavoured
  // OAuth but we allow them because they provide better feedback to the client
  // (in particular when SSO is used).
  oidcAuthorizationResponseErrorSchema,
  // This error is defined by rfc9396 (not part of the OAuth 2.1 or OIDC). But
  // since, in ATproto flavoured OAuth, client registration is a dynamic part of
  // the authorization process, we allow it.
  z.literal('invalid_authorization_details'),
])

export type AuthorizationResponseError = z.infer<
  typeof authorizationResponseErrorSchema
>

export function isAuthorizationResponseError<T>(
  value: T,
): value is T & AuthorizationResponseError {
  return authorizationResponseErrorSchema.safeParse(value).success
}

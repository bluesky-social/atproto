import { z } from 'zod'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-error-response-2}
 */
export const oauthAuthorizationResponseErrorSchema = z.enum([
  // The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.
  'invalid_request',
  // The client is not authorized to request an authorization code using this method.
  'unauthorized_client',
  // The resource owner or authorization server denied the request.
  'access_denied',
  // The authorization server does not support obtaining an authorization code using this method.
  'unsupported_response_type',
  // The requested scope is invalid, unknown, or malformed.
  'invalid_scope',
  // The authorization server encountered an unexpected condition that prevented it from fulfilling the request. (This error code is needed because a 500 Internal Server Error HTTP status code cannot be returned to the client via an HTTP redirect.)
  'server_error',
  // The authorization server is currently unable to handle the request due to a temporary overloading or maintenance of the server. (This error code is needed because a 503 Service Unavailable HTTP status code cannot be returned to the client via an HTTP redirect.)
  'temporarily_unavailable',
])

export type OAuthAuthorizationResponseError = z.infer<
  typeof oauthAuthorizationResponseErrorSchema
>

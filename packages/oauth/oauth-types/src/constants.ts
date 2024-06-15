export const CLIENT_ASSERTION_TYPE_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

export const OAUTH_AUTHENTICATED_ENDPOINT_NAMES = [
  'token',
  'revocation',
  'introspection',
  'pushed_authorization_request',
] as const

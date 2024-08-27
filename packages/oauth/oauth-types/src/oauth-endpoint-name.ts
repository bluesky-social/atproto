export const OAUTH_ENDPOINT_NAMES = [
  'token',
  'revocation',
  'introspection',
  'pushed_authorization_request',
] as const

export type OAuthEndpointName = (typeof OAUTH_ENDPOINT_NAMES)[number]

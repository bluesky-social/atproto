/**
 * A variable that allows to determine if unsecure origins should be allowed
 * in OAuth related URI's. This variable is only set to `true` when NODE_ENV
 * is either `development` or `test`.
 */
export const ALLOW_UNSECURE_ORIGINS = (() => {
  // try/catch to support running in a browser, including when process.env is
  // shimmed (e.g. by webpack)
  try {
    const env = process.env.NODE_ENV
    return env === 'development' || env === 'test'
  } catch {
    return false
  }
})()

export const CLIENT_ASSERTION_TYPE_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

export const OAUTH_AUTHENTICATED_ENDPOINT_NAMES = [
  'token',
  'revocation',
  'introspection',
  'pushed_authorization_request',
] as const

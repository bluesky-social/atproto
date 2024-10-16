/**
 * Per ATProto spec (OpenID uses RS256)
 */
export const FALLBACK_ALG = 'ES256'

/**
 * A variable that allows to determine if unsecure origins should be allowed
 * in OAuth related URI's. This variable is only set to `true` when NODE_ENV
 * is either `development` or `test`.
 */
export const ALLOW_UNSECURE_ORIGINS = (() => {
  // try/catch to support running in a browser, including when process.env is
  // shimmed (e.g. by webpack)
  try {
    return (
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    )
  } catch {
    return false
  }
})()

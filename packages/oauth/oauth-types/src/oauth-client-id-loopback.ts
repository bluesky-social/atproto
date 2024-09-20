import { OAuthClientId } from './oauth-client-id.js'
import { OAuthScope, oauthScopeSchema } from './oauth-scope.js'
import { isLoopbackHost, safeUrl } from './util.js'

const OAUTH_CLIENT_ID_LOOPBACK_URL = 'http://localhost'

export type OAuthClientIdLoopback = OAuthClientId &
  `${typeof OAUTH_CLIENT_ID_LOOPBACK_URL}${'' | '/'}${'' | `?${string}`}`

export function isOAuthClientIdLoopback(
  clientId: string,
): clientId is OAuthClientIdLoopback {
  try {
    parseOAuthLoopbackClientId(clientId)
    return true
  } catch {
    return false
  }
}

export function assertOAuthLoopbackClientId(
  clientId: string,
): asserts clientId is OAuthClientIdLoopback {
  void parseOAuthLoopbackClientId(clientId)
}

// @TODO: should we turn this into a zod schema? (more coherent error with other
// validation functions)
export function parseOAuthLoopbackClientId(clientId: string): {
  scope?: OAuthScope
  redirect_uris?: [string, ...string[]]
} {
  if (!clientId.startsWith(OAUTH_CLIENT_ID_LOOPBACK_URL)) {
    throw new TypeError(
      `Loopback ClientID must start with "${OAUTH_CLIENT_ID_LOOPBACK_URL}"`,
    )
  } else if (clientId.includes('#', OAUTH_CLIENT_ID_LOOPBACK_URL.length)) {
    throw new TypeError('Loopback ClientID must not contain a hash component')
  }

  const queryStringIdx =
    clientId.length > OAUTH_CLIENT_ID_LOOPBACK_URL.length &&
    clientId[OAUTH_CLIENT_ID_LOOPBACK_URL.length] === '/'
      ? OAUTH_CLIENT_ID_LOOPBACK_URL.length + 1
      : OAUTH_CLIENT_ID_LOOPBACK_URL.length

  if (clientId.length === queryStringIdx) {
    return {} // no query string to parse
  }

  if (clientId[queryStringIdx] !== '?') {
    throw new TypeError('Loopback ClientID must not contain a path component')
  }

  const searchParams = new URLSearchParams(clientId.slice(queryStringIdx + 1))

  for (const name of searchParams.keys()) {
    if (name !== 'redirect_uri' && name !== 'scope') {
      throw new TypeError(`Invalid query parameter "${name}" in client ID`)
    }
  }

  const scope = searchParams.get('scope') ?? undefined
  if (scope != null) {
    if (searchParams.getAll('scope').length > 1) {
      throw new TypeError(
        'Loopback ClientID must contain at most one scope query parameter',
      )
    } else if (!oauthScopeSchema.safeParse(scope).success) {
      throw new TypeError('Invalid scope query parameter in client ID')
    }
  }

  const redirect_uris = searchParams.has('redirect_uri')
    ? (searchParams.getAll('redirect_uri') as [string, ...string[]])
    : undefined

  if (redirect_uris) {
    for (const uri of redirect_uris) {
      const url = safeUrl(uri)
      if (!url) {
        throw new TypeError(`Invalid redirect_uri in client ID: ${uri}`)
      }
      if (url.protocol !== 'http:') {
        throw new TypeError(
          `Loopback ClientID must use "http:" redirect_uri's (got ${uri})`,
        )
      }
      if (url.hostname === 'localhost') {
        throw new TypeError(
          `Loopback ClientID must not use "localhost" as redirect_uri hostname (got ${uri})`,
        )
      }
      if (!isLoopbackHost(url.hostname)) {
        throw new TypeError(
          `Loopback ClientID must use loopback addresses as redirect_uri's (got ${uri})`,
        )
      }
    }
  }

  return {
    scope,
    redirect_uris,
  }
}

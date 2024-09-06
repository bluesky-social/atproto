import { parseOAuthClientIdUrl } from './oauth-client-id-url.js'
import { OAuthClientId } from './oauth-client-id.js'

export type OAuthClientIdLoopback = OAuthClientId &
  `http://localhost/${'' | `?${string}`}`

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

export function parseOAuthLoopbackClientId(clientId: string): URL {
  const url = parseOAuthClientIdUrl(clientId)

  if (url.protocol !== 'http:') {
    throw new TypeError('Loopback ClientID must use the "http:" protocol')
  }

  if (url.hostname !== 'localhost') {
    throw new TypeError('Loopback ClientID must use the "localhost" hostname')
  }

  if (url.pathname !== '/') {
    throw new TypeError('Loopback ClientID must not contain a path component')
  }

  if (url.port) {
    throw new TypeError('Loopback ClientID must not contain a port')
  }

  for (const [name, value] of url.searchParams) {
    if (name !== 'redirect_uri' && name !== 'scope') {
      throw new TypeError(`Invalid query parameter ${name} in client ID`)
    }
    if (!value) {
      throw new TypeError(`Empty query parameter ${name} in client ID`)
    }
  }

  if (
    url.searchParams.has('scope') &&
    url.searchParams.getAll('scope').length > 1
  ) {
    throw new TypeError(
      'Loopback ClientID must contain at most one scope query parameter',
    )
  }

  return url
}

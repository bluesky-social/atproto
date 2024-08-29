import { parseOAuthClientIdUrl } from './oauth-client-id-url.js'
import { OAuthClientId } from './oauth-client-id.js'

export type OAuthClientIdLoopback = OAuthClientId &
  `http://localhost${'' | `${'/' | '?' | '#'}${string}`}`

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

  if (url.hash) {
    throw new TypeError('Loopback ClientID must not contain a fragment')
  }

  if (url.username || url.password) {
    throw new TypeError('Loopback ClientID must not contain credentials')
  }

  if (url.port) {
    throw new TypeError('Loopback ClientID must not contain a port')
  }

  for (const name of url.searchParams.keys()) {
    if (name !== 'redirect_uri' && name !== 'scope') {
      throw new TypeError(`Invalid query parameter ${name} in client ID`)
    }
  }

  for (const name of ['redirect_uri', 'scope'] as const) {
    if (!url.searchParams.getAll(name).every(Boolean)) {
      throw new TypeError(`Invalid empty ${name} parameter in client ID`)
    }
  }

  if (url.searchParams.getAll('scope').length > 1) {
    throw new TypeError('Multiple scope parameters are not allowed')
  }

  return url
}

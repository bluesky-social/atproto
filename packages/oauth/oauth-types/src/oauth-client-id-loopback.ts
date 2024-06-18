import { parseOAuthClientIdUrl } from './oauth-client-id-url.js'
import { OAuthClientId } from './oauth-client-id.js'

export type OAuthClientIdLoopback = OAuthClientId &
  `http://localhost${'' | `${'/' | '?' | '#'}${string}`}`

export function isOAuthClientIdLoopback<C extends OAuthClientId>(
  clientId: C,
): clientId is C & OAuthClientIdLoopback {
  try {
    parseOAuthLoopbackClientId(clientId)
    return true
  } catch {
    return false
  }
}

export function parseOAuthLoopbackClientId(clientId: OAuthClientId): URL {
  const url = parseOAuthClientIdUrl(clientId)

  // Optimization: cheap checks first

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

  // Note: url.pathname === '/' is allowed for loopback URIs

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    throw new TypeError('Loopback ClientID must not end with a trailing slash')
  }

  if (url.pathname.includes('//')) {
    throw new TypeError(
      `Loopback ClientID must not contain any double slashes in its path`,
    )
  }

  // Note: Query string is allowed

  return url
}

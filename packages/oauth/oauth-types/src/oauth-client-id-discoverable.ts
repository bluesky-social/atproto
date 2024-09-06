import { parseOAuthClientIdUrl } from './oauth-client-id-url.js'
import { OAuthClientId } from './oauth-client-id.js'

/**
 * @see {@link https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html}
 */
export type OAuthClientIdDiscoverable = OAuthClientId & `https://${string}`

export function isOAuthClientIdDiscoverable(
  clientId: string,
): clientId is OAuthClientIdDiscoverable {
  try {
    parseOAuthDiscoverableClientId(clientId)
    return true
  } catch {
    return false
  }
}

export function assertOAuthDiscoverableClientId(
  value: string,
): asserts value is OAuthClientIdDiscoverable {
  void parseOAuthDiscoverableClientId(value)
}

export function parseOAuthDiscoverableClientId(clientId: string): URL {
  const url = parseOAuthClientIdUrl(clientId)

  if (url.hostname === 'localhost') {
    throw new TypeError('ClientID hostname must not be "localhost"')
  }

  if (url.protocol !== 'https:') {
    throw new TypeError('ClientID must use the "https:" protocol')
  }

  if (url.pathname === '/') {
    throw new TypeError(
      'ClientID must contain a path component (e.g. "/client-metadata.json")',
    )
  }

  if (url.pathname.endsWith('/')) {
    throw new TypeError('ClientID path must not end with a trailing slash')
  }

  return url
}

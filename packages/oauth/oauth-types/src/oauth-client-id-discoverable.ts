import { OAuthClientId } from './oauth-client-id.js'
import { extractUrlPath, isHostnameIP } from './util.js'

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
  const url = new URL(clientId)

  if (url.protocol !== 'https:') {
    throw new TypeError('ClientID must use the "https:" protocol')
  }

  if (url.username || url.password) {
    throw new TypeError('ClientID must not contain credentials')
  }

  if (url.hash) {
    throw new TypeError('ClientID must not contain a fragment')
  }

  if (url.hostname === 'localhost') {
    throw new TypeError('ClientID hostname must not be "localhost"')
  }

  if (url.pathname === '/') {
    throw new TypeError(
      'ClientID must contain a path component (e.g. "/client-metadata.json")',
    )
  }

  if (url.pathname.endsWith('/')) {
    throw new TypeError('ClientID path must not end with a trailing slash')
  }

  if (isHostnameIP(url.hostname)) {
    throw new TypeError('ClientID hostname must not be an IP address')
  }

  // URL constructor normalizes the URL, so we extract the path manually to
  // avoid normalization, then compare it to the normalized path to ensure
  // that the URL does not contain path traversal or other unexpected characters
  if (extractUrlPath(clientId) !== url.pathname) {
    throw new TypeError(
      `ClientID must be in canonical form ("${url.href}", got "${clientId}")`,
    )
  }

  return url
}

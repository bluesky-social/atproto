import { OAuthClientId } from './oauth-client-id.js'

export function parseOAuthClientIdUrl(clientId: OAuthClientId): URL {
  if (clientId.endsWith('/')) {
    throw new TypeError('ClientID must not end with a trailing slash')
  }

  const url = new URL(clientId)

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('ClientID must use the "https:" or "http:" protocol')
  }

  url.searchParams.sort()

  // URL constructor normalizes the URL, so we need to compare the canonical form
  const canonicalUri = url.pathname === '/' ? url.origin + url.search : url.href
  if (canonicalUri !== clientId) {
    throw new TypeError(
      `ClientID must be in canonical form ("${canonicalUri}", got "${clientId}")`,
    )
  }

  return url
}

import { extractUrlPath, isHostnameIP } from './util.js'

export function parseOAuthClientIdUrl(clientId: string): URL {
  const url = new URL(clientId)

  if (url.hash) {
    throw new TypeError('ClientID must not contain a fragment')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('ClientID must use the "https:" or "http:" protocol')
  }

  if (url.username || url.password) {
    throw new TypeError('ClientID must not contain credentials')
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

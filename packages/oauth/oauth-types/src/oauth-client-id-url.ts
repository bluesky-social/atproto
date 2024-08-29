export function parseOAuthClientIdUrl(clientId: string): URL {
  const url = new URL(clientId)

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('ClientID must use the "https:" or "http:" protocol')
  }

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    throw new TypeError('ClientID path must not end with a trailing slash')
  }

  // URL constructor normalizes the "/./" and "/../" in the pathname, but not
  // "//".
  if (url.pathname.includes('//')) {
    throw new TypeError(
      `Loopback ClientID must not contain any double slashes in its path`,
    )
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

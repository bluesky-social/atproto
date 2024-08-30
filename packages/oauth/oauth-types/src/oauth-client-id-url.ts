export function parseOAuthClientIdUrl(clientId: string): URL {
  const url = new URL(clientId)

  // assert(hasHttpsScheme(clientId))
  // assert(hasPathComponent(clientId))
  // assert(noPathTraversal(clientId))
  // assert(noFragment(clientId))
  // assert(noUsernamePassword(clientId))

  if (url.hash) {
    throw new TypeError('ClientID must not contain a fragment')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('ClientID must use the "https:" or "http:" protocol')
  }

  if (url.username || url.password) {
    throw new TypeError('ClientID must not contain credentials')
  }

  if (url.pathname === '/') {
    throw new TypeError(
      'ClientID must contain a path (e.g. "/client-metadata.json")',
    )
  }

  if (url.pathname.endsWith('/')) {
    throw new TypeError('ClientID path must not end with a trailing slash')
  }

  // URL constructor will check (and normalize) path traversal. The following
  // check will thus ensure that no path traversal is present in the url.
  // However, the URL constructor will also normalize other parts of the URL
  // (lowercasing the hostname, removing the default port, etc.), so the
  // following check is stricter that the rules in the Atproto spec. Relying on
  // the URL constructor is however more robust and less error-prone than trying
  // to implement the same checks manually.
  if (url.href !== clientId) {
    throw new TypeError(
      `ClientID must be in canonical form ("${url.href}", got "${clientId}")`,
    )
  }

  return url
}
